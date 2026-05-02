import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  logError,
} from '../../_helpers'
import { AnswerRequestSchema } from '../../_schemas'
import {
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

// ── POST /api/v2/game/answer ─────────────────────────────────
// Processes the user's answer, returns next question or a guess

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const parsed = await parseJsonBodyWithSchema(context.request, AnswerRequestSchema)
  if (!parsed.success) return parsed.response
  const { sessionId, value } = parsed.data

  // Load session
  const session = await loadSession(kv, sessionId)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  if (!session.currentQuestion) {
    return errorResponse('No pending question to answer', 400)
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

  // Pre-compute probabilities once — reused by evaluateGuessReadiness and selectBestQuestion
  // to avoid redundant O(C×A) passes over the same data.
  const probs = calculateProbabilities(filtered, session.answers, scoring)

  // AN.11/AN.21: record posterior history and top-10 after each answer.
  updatePosteriorHistory(session, probs, filtered)

  // Check for contradictions
  const { hasContradiction } = detectContradictions(filtered, session.answers)
  if (hasContradiction) {
    return jsonResponse(
      await rollbackAndBuildContradictionResponse({
        kv,
        session,
      })
    )
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

  // Check if we should guess
  if (responseReadiness.shouldGuess && !responseReadiness.blockedByRejectCooldown) {
    const guessResponse = await finalizeBestGuessForSession({
      kv,
      session,
      filtered,
      scoring,
      questionCount,
      remaining: filtered.length,
      readiness: responseReadiness,
      recordAnalytics: true,
    })
    if (guessResponse) {
      return jsonResponse(guessResponse)
    }
  }

  // Load runtime adaptive data (parallel — best-effort, failures are non-fatal)
  const db = context.env.GUESS_DB
  const adaptive = await loadAdaptiveData(kv, db)

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
    const guessResponse = await finalizeBestGuessForSession({
      kv,
      session,
      filtered,
      scoring,
      questionCount,
      remaining: filtered.length,
    })

    if (guessResponse) {
      return jsonResponse(guessResponse)
    }

    return errorResponse('No questions or candidates available', 500)
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

  return jsonResponse(response)
  } catch (err) {
    console.error('POST /api/v2/game/answer error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'answer', 'error', 'answer processing failed', err))
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Answer processing failed: ${message}`, 500)
  }
}
