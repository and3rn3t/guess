import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  getOrCreateUserId,
  withSetCookie,
  d1Run,
  logError,
} from '../../_helpers'
import { ResultRequestSchema } from '../../_schemas'
import { loadSession, deleteSession, getBestGuess } from '../_game-engine'

// ── POST /api/v2/game/result ─────────────────────────────────
// Records game outcome (win/loss) and cleans up the session

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
  const kv = context.env.GUESS_KV
  const db = context.env.GUESS_DB
  if (!kv) return errorResponse('KV not configured', 503)

  const parsed = await parseJsonBodyWithSchema(context.request, ResultRequestSchema)
  if (!parsed.success) return parsed.response
  const { sessionId, correct, actualCharacterId: _actualCharacterId } = parsed.data

  // Load session
  const session = await loadSession(kv, sessionId)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)

  // Build steps from session answers + questions
  const steps = session.answers.map((a) => {
    const q = session.questions.find((q) => q.attribute === a.questionId)
    return {
      questionText: q?.text ?? a.questionId,
      attribute: a.questionId,
      answer: a.value,
    }
  })

  // Find the guessed character (the top candidate)
  let characterId: string | null = null
  let characterName: string | null = null
  if (session.characters.length > 0) {
    const guess = getBestGuess(session.characters, session.answers, session.rejectedGuesses)
    if (guess) {
      characterId = guess.id
      characterName = guess.name
    }
  }

  // Record stats in D1 if available (non-blocking — offloaded to waitUntil)
  if (db) {
    context.waitUntil(
      d1Run(
        db,
        `INSERT INTO game_stats (user_id, won, difficulty, questions_asked, character_pool_size, character_id, character_name, steps, guesses_used, confidence_at_guess, entropy_at_guess, remaining_at_guess, answer_distribution, guess_trigger, forced_guess, gap_at_guess, alive_count_at_guess, questions_remaining_at_guess, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          correct ? 1 : 0,
          session.difficulty,
          session.answers.length,
          session.characters.length,
          characterId,
          characterName,
          JSON.stringify(steps),
          session.guessCount,
          session.guessAnalytics?.confidence ?? null,
          session.guessAnalytics?.entropy ?? null,
          session.guessAnalytics?.remaining ?? null,
          session.guessAnalytics?.answerDistribution
            ? JSON.stringify(session.guessAnalytics.answerDistribution)
            : null,
          session.guessAnalytics?.trigger ?? null,
          session.guessAnalytics?.forced ? 1 : 0,
          session.guessAnalytics?.gap ?? null,
          session.guessAnalytics?.aliveCount ?? null,
          session.guessAnalytics?.questionsRemaining ?? null,
          Date.now(),
        ]
      ).catch(() => { /* non-critical */ })
    )
  }

  // Clean up session + pool from KV
  await deleteSession(kv, sessionId)

  // Mark D1 backup as completed (non-blocking)
  if (db) {
    context.waitUntil(
      d1Run(db, 'UPDATE game_sessions SET completed_at = ?, dropped_at_phase = NULL WHERE id = ?', [Date.now(), sessionId])
        .catch(() => {/* non-critical */})
    )
  }

  return withSetCookie(jsonResponse({
    success: true,
    summary: {
      won: correct,
      difficulty: session.difficulty,
      questionsAsked: session.answers.length,
      maxQuestions: session.maxQuestions,
      poolSize: session.characters.length,
      guessesUsed: session.guessCount,
    },
  }), setCookieHeader)
  } catch (err) {
    console.error('POST /api/v2/game/result error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'result', 'error', 'result recording failed', err))
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Result recording failed: ${message}`, 500)
  }
}
