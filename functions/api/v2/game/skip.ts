import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
} from '../../_helpers'
import {
  filterPossibleCharacters,
  generateReasoning,
  selectBestQuestion,
  calculateProbabilities,
  loadSession,
  saveSessionState,
} from '../_game-engine'
import { rephraseQuestion } from '../_llm-rephrase'

// ── Types ────────────────────────────────────────────────────

interface SkipRequest {
  sessionId: string
}

// ── POST /api/v2/game/skip ───────────────────────────────────
// Skips the current question (free — does not decrement questionsRemaining).
// Returns the next best question from the remaining un-skipped pool.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<SkipRequest>(context.request)
  if (!body?.sessionId) {
    return errorResponse('Invalid request: sessionId required', 400)
  }

  const session = await loadSession(kv, body.sessionId)
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

  // Build scoring options (reuse coverage/popularity maps when available)
  let coverageMap = session.coverageMap
  if (!coverageMap) {
    coverageMap = new Map<string, number>()
    const charCount = session.characters.length
    for (const q of session.questions) {
      const known = session.characters.filter((c) => c.attributes[q.attribute] != null).length
      coverageMap.set(q.attribute, known / charCount)
    }
  }
  const scoring = { coverageMap, popularityMap: session.popularityMap }
  const probs = calculateProbabilities(filtered, session.answers, scoring)

  // Load runtime adaptive data (parallel — best-effort, failures are non-fatal)
  const db = context.env.GUESS_DB
  const [maybeRatesRaw, netGainsRaw, confusionRaw, disputeRows] = await Promise.allSettled([
    kv.get('kv:attribute-maybe-rates', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:attribute-net-gains', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:confusion-discriminators', 'json') as Promise<Record<string, string[]> | null>,
    db
      ? db.prepare(`SELECT character_id, attribute_key, confidence FROM attribute_disputes WHERE status = 'open'`)
           .all<{ character_id: string; attribute_key: string; confidence: number }>()
           .then((r) => r.results)
      : Promise.resolve([] as Array<{ character_id: string; attribute_key: string; confidence: number }>),
  ])

  const maybeRateMap = maybeRatesRaw.status === 'fulfilled' ? (maybeRatesRaw.value ?? undefined) : undefined
  const netGainMap = netGainsRaw.status === 'fulfilled' ? (netGainsRaw.value ?? undefined) : undefined
  const confusionDiscriminators = confusionRaw.status === 'fulfilled' ? (confusionRaw.value ?? undefined) : undefined

  let disputeMap: Record<string, Record<string, number>> | undefined
  if (disputeRows.status === 'fulfilled' && disputeRows.value.length > 0) {
    disputeMap = {}
    for (const row of disputeRows.value) {
      disputeMap[row.character_id] ??= {}
      disputeMap[row.character_id]![row.attribute_key] = row.confidence
    }
  }

  // Select next question, excluding all previously skipped ones
  const availableQuestions = session.questions.filter(
    (q) => !session.skippedQuestions.includes(q.attribute)
  )

  const questionCount = session.answers.length
  const progress = questionCount / session.maxQuestions
  const recentCategories = session.answers.slice(-3)
    .map((a) => session.questions.find((q) => q.attribute === a.questionId)?.category)
    .filter((c): c is string => c != null)

  const nextQuestion = selectBestQuestion(filtered, session.answers, availableQuestions, {
    progress,
    recentCategories,
    scoring: { ...scoring, disputeMap },
    probs,
    mctsEndgameThreshold: session.difficulty === 'hard' ? 0.70 : undefined,
    maybeRateMap: maybeRateMap ?? undefined,
    netGainMap: netGainMap ?? undefined,
    confusionDiscriminators: confusionDiscriminators ?? undefined,
  })

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
}
