import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  d1Run,
} from '../../_helpers'
import {
  type GameSession,
  type AnswerValue,
  filterPossibleCharacters,
  detectContradictions,
  shouldMakeGuess,
  getBestGuess,
  selectBestQuestion,
  generateReasoning,
  calculateProbabilities,
  loadSession,
  saveSessionState,
  VALID_ANSWERS,
} from '../_game-engine'

// ── Types ────────────────────────────────────────────────────

interface AnswerRequest {
  sessionId: string
  value: AnswerValue
}

// ── POST /api/v2/game/answer ─────────────────────────────────
// Processes the user's answer, returns next question or a guess

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<AnswerRequest>(context.request)
  if (!body?.sessionId || !body?.value || !VALID_ANSWERS.has(body.value)) {
    return errorResponse('Invalid request: sessionId and valid answer value required', 400)
  }

  // Load session
  const session = await loadSession(kv, body.sessionId)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  if (!session.currentQuestion) {
    return errorResponse('No pending question to answer', 400)
  }

  // Record answer (questionId is the attribute key)
  const newAnswer = {
    questionId: session.currentQuestion.attribute,
    value: body.value,
  }
  session.answers.push(newAnswer)

  // Filter characters (hard elimination + rejected guesses)
  const filtered = filterPossibleCharacters(session.characters, session.answers, session.rejectedGuesses)

  // Check for contradictions
  const { hasContradiction } = detectContradictions(filtered, session.answers)
  if (hasContradiction) {
    // Undo the last answer
    session.answers.pop()
    // Restore current question
    await saveSessionState(kv, session)

    return jsonResponse({
      type: 'contradiction',
      message: 'Your answers seem contradictory — no characters match. Last answer was undone.',
      question: session.currentQuestion,
      reasoning: generateReasoning(session.currentQuestion, session.characters, session.answers),
      remaining: session.characters.length,
      questionCount: session.answers.length,
    })
  }

  const questionCount = session.answers.length

  // Check if we should guess
  if (shouldMakeGuess(filtered, session.answers, questionCount, session.maxQuestions, session.guessCount)) {
    const guess = getBestGuess(filtered, session.answers, session.rejectedGuesses)
    if (guess) {
      const probs = calculateProbabilities(filtered, session.answers)
      const confidence = Math.round((probs.get(guess.id) || 0) * 100)

      session.currentQuestion = null
      session.guessCount += 1
      await saveSessionState(kv, session)

      return jsonResponse({
        type: 'guess',
        character: {
          id: guess.id,
          name: guess.name,
          category: guess.category,
          imageUrl: guess.imageUrl,
        },
        confidence,
        questionCount,
        remaining: filtered.length,
        guessCount: session.guessCount,
      })
    }
  }

  // Select next question
  const nextQuestion = selectBestQuestion(filtered, session.answers, session.questions)

  if (!nextQuestion) {
    // No more questions — force a guess
    const guess = getBestGuess(filtered, session.answers, session.rejectedGuesses)
    session.currentQuestion = null
    session.guessCount += 1
    await saveSessionState(kv, session)

    if (guess) {
      const probs = calculateProbabilities(filtered, session.answers)
      const confidence = Math.round((probs.get(guess.id) || 0) * 100)

      return jsonResponse({
        type: 'guess',
        character: {
          id: guess.id,
          name: guess.name,
          category: guess.category,
          imageUrl: guess.imageUrl,
        },
        confidence,
        questionCount,
        remaining: filtered.length,
        guessCount: session.guessCount,
      })
    }

    return errorResponse('No questions or candidates available', 500)
  }

  const reasoning = generateReasoning(nextQuestion, filtered, session.answers)

  // Count eliminated
  const previousFiltered = filterPossibleCharacters(
    session.characters,
    session.answers.slice(0, -1),
    session.rejectedGuesses
  )
  const eliminated = previousFiltered.length - filtered.length

  // Save updated session
  session.currentQuestion = nextQuestion
  await saveSessionState(kv, session)

  // Sync answers to D1 backup (non-blocking)
  const db = context.env.GUESS_DB
  if (db) {
    context.waitUntil(
      d1Run(
        db,
        `UPDATE game_sessions SET answers = ?, current_question_attr = ? WHERE id = ?`,
        [JSON.stringify(session.answers), nextQuestion.attribute, session.id]
      ).catch(() => {/* non-critical */})
    )
  }

  return jsonResponse({
    type: 'question',
    question: nextQuestion,
    reasoning,
    remaining: filtered.length,
    eliminated,
    questionCount,
  })
}
