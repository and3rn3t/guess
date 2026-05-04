import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  getRequestId,
  getActorId,
  internalErrorResponse,
  withRequestId,
  logError,
} from '../../_helpers'
import { AnswerRequestSchema } from '../../_schemas'
import {
  type AdaptiveData,
  detectContradictions,
  evaluateGuessReadiness,
  calculateProbabilities,
  loadSession,
  loadAdaptiveData,
  getOrBuildCoverageMap,
} from '../_game-engine'
import { rollbackAndBuildContradictionResponse } from './_contradiction'
import {
  buildNextQuestionResponse,
  persistAndSyncAnswerTurn,
  applyAnswerAndFilter,
} from './_question-flow'
import { finalizeBestGuessForSession } from './_guess-flow'
import {
  getRecentQuestionCategories,
  selectNextQuestionForTurn,
} from './_question-selection'
import { updatePosteriorHistory } from './_posterior-history'
import { applyRejectCooldown } from './_readiness'
import {
  buildQuestionAttemptInput,
  queueQuestionAttemptWrite,
} from './_turn-effects'

const EMPTY_ADAPTIVE_DATA: AdaptiveData = {
  maybeRateMap: undefined,
  netGainMap: undefined,
  confusionDiscriminators: undefined,
  disputeMap: undefined,
  attributeTrustMap: undefined,
  characterPopularityMap: undefined,
  questionEmpiricalGainMap: undefined,
  questionQualityPenaltyMap: undefined,
  confusionPairs: undefined,
  activeWeights: undefined,
}

function prefetchAdaptiveData(
  kv: KVNamespace,
  db: D1Database | undefined,
): Promise<AdaptiveData> {
  return loadAdaptiveData(kv, db).catch(() => EMPTY_ADAPTIVE_DATA)
}

async function finalizeGuessJsonResponse(
  input: Parameters<typeof finalizeBestGuessForSession>[0],
): Promise<Response | null> {
  const guessResponse = await finalizeBestGuessForSession(input)
  return guessResponse ? jsonResponse(guessResponse) : null
}

async function maybeFinalizeReadinessGuess(
  input: {
    readiness: { shouldGuess: boolean; blockedByRejectCooldown: boolean }
  } & Omit<Parameters<typeof finalizeBestGuessForSession>[0], 'recordAnalytics' | 'readiness'>
): Promise<Response | null> {
  if (!input.readiness.shouldGuess || input.readiness.blockedByRejectCooldown) {
    return null
  }

  return finalizeGuessJsonResponse({
    ...input,
    readiness: input.readiness,
    recordAnalytics: true,
  })
}

// ── POST /api/v2/game/answer ─────────────────────────────────
// Processes the user's answer, returns next question or a guess

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request)
  const actorId = getActorId(context.request)
  const url = new URL(context.request.url)
  const respond = (response: Response): Response => withRequestId(response, requestId)
  const internalError = (): Response =>
    respond(internalErrorResponse(requestId))

  try {
  const kv = context.env.GUESS_KV
  if (!kv) return respond(errorResponse('KV not configured', 503))

  const parsed = await parseJsonBodyWithSchema(context.request, AnswerRequestSchema)
  if (!parsed.success) return respond(parsed.response)
  const { sessionId, value } = parsed.data

  // Load session
  const session = await loadSession(kv, sessionId)
  if (!session) {
    return respond(errorResponse('Session not found or expired', 404))
  }

  if (!session.currentQuestion) {
    return respond(errorResponse('No pending question to answer', 400))
  }

  const {
    askedQuestion,
    questionIndex,
    candidatesBefore,
    filtered,
  } = applyAnswerAndFilter(session, value)

  // Persist question_attempts row (fire-and-forget). Powers per-question empirical
  // info-gain analytics (kv:question-empirical-gain) and per-question skip/maybe rates.
  queueQuestionAttemptWrite(
    context.waitUntil,
    context.env.GUESS_DB,
    buildQuestionAttemptInput({
      sessionId,
      askedQuestion,
      answer: value,
      candidatesBefore,
      candidatesAfter: filtered.length,
      questionIndex,
      createdAt: Date.now(),
    }),
  )

  const coverageMap = getOrBuildCoverageMap(session)
  const scoring = { coverageMap, popularityMap: session.popularityMap }
  const db = context.env.GUESS_DB

  // Pre-compute probabilities once — reused by evaluateGuessReadiness and selectBestQuestion
  // to avoid redundant O(C×A) passes over the same data.
  const probs = calculateProbabilities(filtered, session.answers, scoring)

  // Kick off adaptive-data loading in parallel with readiness checks. This saves
  // one await in the common "continue asking" path while staying best-effort.
  const adaptivePromise = prefetchAdaptiveData(kv, db)

  // AN.11/AN.21: record posterior history and top-10 after each answer.
  updatePosteriorHistory(session, probs, filtered)

  // Check for contradictions
  const { hasContradiction } = detectContradictions(filtered, session.answers)
  if (hasContradiction) {
    return respond(jsonResponse(
      await rollbackAndBuildContradictionResponse({
        kv,
        session,
      })
    ))
  }

  const questionCount = session.answers.length
  // Pass pre-computed probs to avoid recalculating inside evaluateGuessReadiness
  const readiness = evaluateGuessReadiness(
    filtered,
    session.answers,
    questionCount,
    session.maxQuestions,
    session.guessCount,
    scoring,
    probs,
  )

  const responseReadiness = applyRejectCooldown(session, readiness)

  const readinessGuessResponse = await maybeFinalizeReadinessGuess({
    kv,
    session,
    filtered,
    scoring,
    questionCount,
    remaining: filtered.length,
    readiness: responseReadiness,
  })
  if (readinessGuessResponse) {
    return respond(readinessGuessResponse)
  }

  // Load runtime adaptive data (already in-flight; best-effort)
  const adaptive = await adaptivePromise

  // Select next question (pass pre-computed probs for efficiency)
  const nextQuestion = selectNextQuestionForTurn({
    session,
    filtered,
    questions: session.questions,
    scoring,
    adaptive,
    probs,
    recentCategories: getRecentQuestionCategories(session),
    selector: session.selector ?? 'mcts',
  })

  if (!nextQuestion) {
    // No more questions — force a guess
    const forcedGuessResponse = await finalizeGuessJsonResponse({
      kv,
      session,
      filtered,
      scoring,
      questionCount,
      remaining: filtered.length,
    })

    if (forcedGuessResponse) {
      return respond(forcedGuessResponse)
    }

    return respond(errorResponse('No questions or candidates available', 500))
  }

  const { reasoning, response } = buildNextQuestionResponse({
    session,
    nextQuestion,
    filtered,
    scoring,
    questionCount,
    readiness: responseReadiness,
  })

  await persistAndSyncAnswerTurn({
    env: context.env,
    kv,
    db,
    waitUntil: context.waitUntil,
    session,
    nextQuestion,
    reasoning,
    questionNumber: questionCount + 1,
  })

  return respond(jsonResponse(response))
  } catch (err) {
    console.error('POST /api/v2/game/answer error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'answer', 'error', 'answer processing failed', err, {
      requestId,
      actorId,
      path: url.pathname,
      method: context.request.method,
      status: 500,
    }))
    return internalError()
  }
}
