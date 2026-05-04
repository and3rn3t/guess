import {
  type Env,
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
  calculateProbabilities,
  loadSession,
  getOrBuildCoverageMap,
} from '../_game-engine'
import { applyAnswerAndFilter } from './_question-flow'
import { updatePosteriorHistory } from './_posterior-history'
import {
  buildQuestionAttemptInput,
  queueQuestionAttemptWrite,
} from './_turn-effects'
import {
  prefetchAdaptiveData,
  maybeHandleContradiction,
  computeResponseReadiness,
  maybeFinalizeReadinessGuess,
  continueWithNextQuestion,
} from './_answer_orchestration'

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

  const contradictionResponse = await maybeHandleContradiction({
    kv,
    session,
    filtered,
  })
  if (contradictionResponse) {
    return respond(contradictionResponse)
  }

  const questionCount = session.answers.length
  const responseReadiness = computeResponseReadiness({
    session,
    filtered,
    scoring,
    probs,
  })

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

  return respond(
    await continueWithNextQuestion({
      env: context.env,
      waitUntil: context.waitUntil,
      kv,
      db,
      session,
      filtered,
      scoring,
      adaptive,
      probs,
      questionCount,
      readiness: responseReadiness,
    }),
  )
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
