import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  logError,
} from '../../_helpers'
import { SkipRequestSchema } from '../../_schemas'
import {
  filterPossibleCharacters,
  generateReasoning,
  selectBestQuestion,
  calculateProbabilities,
  loadSession,
  saveSessionState,
  loadAdaptiveData,
  getOrBuildCoverageMap,
  buildQuestionOptions,
} from '../_game-engine'
import { rephraseQuestion } from '../_llm-rephrase'


// ── POST /api/v2/game/skip ───────────────────────────────────
// Skips the current question (free — does not decrement questionsRemaining).
// Returns the next best question from the remaining un-skipped pool.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const parsed = await parseJsonBodyWithSchema(context.request, SkipRequestSchema)
  if (!parsed.success) return parsed.response
  const { sessionId } = parsed.data

  const session = await loadSession(kv, sessionId)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  if (!session.currentQuestion) {
    return errorResponse('No pending question to skip', 400)
  }

  // Record the skipped question so it is excluded from future selection
  const skippedAttr = session.currentQuestion.attribute
  if (!session.skippedQuestions.includes(skippedAttr)) {
    session.skippedQuestions.push(skippedAttr)
  }
  session.currentQuestion = null

  // Compute filtered candidates
  const filtered = filterPossibleCharacters(session.characters, session.answers, session.rejectedGuesses)

  const coverageMap = getOrBuildCoverageMap(session)
  const scoring = { coverageMap, popularityMap: session.popularityMap }
  const probs = calculateProbabilities(filtered, session.answers, scoring)

  // Load runtime adaptive data (parallel — best-effort, failures are non-fatal)
  const db = context.env.GUESS_DB
  const adaptive = await loadAdaptiveData(kv, db)

  // Select next question, excluding all previously skipped ones
  const availableQuestions = session.questions.filter(
    (q) => !session.skippedQuestions.includes(q.attribute)
  )

  const questionCount = session.answers.length
  const progress = questionCount / session.maxQuestions
  const recentCategories = session.answers.slice(-3)
    .map((a) => session.questions.find((q) => q.attribute === a.questionId)?.category)
    .filter((c): c is string => c != null)

  const nextQuestion = selectBestQuestion(filtered, session.answers, availableQuestions,
    buildQuestionOptions(session, scoring, adaptive, { progress, probs, recentCategories })
  )

  if (!nextQuestion) {
    // All questions exhausted — save state and signal the client
    await saveSessionState(kv, session)
    return errorResponse('No more questions available to skip to', 409)
  }

  const reasoning = generateReasoning(nextQuestion, filtered, session.answers, scoring)
  const questionLookup = new Map(session.questions.map((q) => [q.attribute, q.text]))

  session.currentQuestion = nextQuestion
  const [rephrased] = await Promise.all([
    rephraseQuestion(
      context.env,
      nextQuestion,
      session.answers,
      reasoning,
      questionCount + 1,
      session.maxQuestions,
      questionLookup,
      session.persona,
    ),
    saveSessionState(kv, session),
  ])
  if (rephrased) nextQuestion.displayText = rephrased

  return jsonResponse({
    type: 'question',
    question: nextQuestion,
    reasoning,
    remaining: filtered.length,
    questionCount,
    skippedCount: session.skippedQuestions.length,
  })
  } catch (err) {
    console.error('POST /api/v2/game/skip error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'skip', 'error', 'skip failed', err))
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Skip failed: ${message}`, 500)
  }
}
