import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  d1Run,
} from '../../_helpers'
import {
  filterPossibleCharacters,
  selectBestQuestion,
  generateReasoning,
  loadSession,
  saveSessionState,
  BONUS_QUESTIONS_PER_REJECT,
  DIFFICULTY_MAP,
} from '../_game-engine'
import { rephraseQuestion } from '../_llm-rephrase'

// ── Types ────────────────────────────────────────────────────

interface RejectGuessRequest {
  sessionId: string
  characterId: string
}

// ── POST /api/v2/game/reject-guess ───────────────────────────
// User rejected the AI's guess. Exclude that character, extend
// question budget, and return the next question — or signal
// exhaustion if no viable candidates remain.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<RejectGuessRequest>(context.request)
  if (!body?.sessionId || !body?.characterId) {
    return errorResponse('Invalid request: sessionId and characterId required', 400)
  }

  const session = await loadSession(kv, body.sessionId)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  // Add rejected character
  if (!session.rejectedGuesses.includes(body.characterId)) {
    session.rejectedGuesses.push(body.characterId)
  }

  // Extend question budget (bonus per rejection, capped at base × 2)
  const baseBudget = DIFFICULTY_MAP[session.difficulty] ?? 15
  const bonus = BONUS_QUESTIONS_PER_REJECT[session.difficulty] ?? 2

  // Rarity factor: smaller remaining pool → fewer bonus questions
  const filtered = filterPossibleCharacters(session.characters, session.answers, session.rejectedGuesses)
  const effectiveBonus = filtered.length < 10 ? Math.max(1, Math.floor(bonus / 2)) : bonus
  const hardCap = baseBudget * 2

  session.maxQuestions = Math.min(session.maxQuestions + effectiveBonus, hardCap)

  // Require extra evidence after a wrong guess: ask 1-2 more answers before allowing another guess.
  const questionsRemaining = Math.max(0, session.maxQuestions - session.answers.length)
  const desiredCooldown = filtered.length > 12 ? 2 : 1
  session.postRejectCooldown = Math.min(desiredCooldown, questionsRemaining)

  // Check if any viable candidates remain
  if (filtered.length === 0) {
    await saveSessionState(kv, session)
    return jsonResponse({
      type: 'exhausted',
      message: "I've run out of candidates — you stumped me!",
      questionCount: session.answers.length,
      guessCount: session.guessCount,
      rejectCooldownRemaining: session.postRejectCooldown,
    })
  }

  // Select next question (pass progress for dynamic top-K threshold)
  const progress = session.answers.length / session.maxQuestions
  const nextQuestion = selectBestQuestion(filtered, session.answers, session.questions, { progress })

  if (!nextQuestion) {
    // No more unanswered questions but candidates remain — exhausted
    await saveSessionState(kv, session)
    return jsonResponse({
      type: 'exhausted',
      message: "I've run out of questions to ask — you stumped me!",
      questionCount: session.answers.length,
      guessCount: session.guessCount,
      rejectCooldownRemaining: session.postRejectCooldown,
    })
  }

  const reasoning = generateReasoning(nextQuestion, filtered, session.answers)

  // Rephrase question via LLM for conversational feel (graceful fallback)
  const rephrased = await rephraseQuestion(
    context.env,
    nextQuestion,
    session.answers,
    reasoning,
    session.answers.length + 1,
    session.maxQuestions,
  )
  if (rephrased) {
    nextQuestion.displayText = rephrased
  }

  session.currentQuestion = nextQuestion
  await saveSessionState(kv, session)

  // Sync to D1 backup (non-blocking)
  const db = context.env.GUESS_DB
  if (db) {
    context.waitUntil(
      d1Run(
        db,
        `UPDATE game_sessions SET current_question_attr = ?, max_questions = ? WHERE id = ?`,
        [nextQuestion.attribute, session.maxQuestions, session.id]
      ).catch(() => {/* non-critical */})
    )
  }

  return jsonResponse({
    type: 'question',
    question: nextQuestion,
    reasoning,
    remaining: filtered.length,
    questionCount: session.answers.length,
    maxQuestions: session.maxQuestions,
    guessCount: session.guessCount,
    rejectCooldownRemaining: session.postRejectCooldown,
  })
}
