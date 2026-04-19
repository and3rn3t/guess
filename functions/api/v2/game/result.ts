import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  kvGetObject,
  getUserId,
  d1Run,
} from '../../_helpers'
import type { GameSession } from '../_game-engine'

// ── Types ────────────────────────────────────────────────────

interface ResultRequest {
  sessionId: string
  correct: boolean
  actualCharacterId?: string
}

// ── POST /api/v2/game/result ─────────────────────────────────
// Records game outcome (win/loss) and cleans up the session

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  const db = context.env.GUESS_DB
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<ResultRequest>(context.request)
  if (!body?.sessionId || typeof body.correct !== 'boolean') {
    return errorResponse('Invalid request: sessionId and correct required', 400)
  }

  // Load session
  const session = await kvGetObject<GameSession>(kv, `game:${body.sessionId}`)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  const userId = getUserId(context.request)

  // Record stats in D1 if available
  if (db) {
    try {
      await d1Run(
        db,
        `INSERT INTO game_stats (user_id, won, difficulty, questions_asked, character_pool_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          body.correct ? 1 : 0,
          session.difficulty,
          session.answers.length,
          session.characters.length,
          Date.now(),
        ]
      )
    } catch {
      // Stats table may not exist yet — non-critical
    }
  }

  // Clean up session
  await kv.delete(`game:${body.sessionId}`)

  return jsonResponse({
    success: true,
    summary: {
      won: body.correct,
      difficulty: session.difficulty,
      questionsAsked: session.answers.length,
      maxQuestions: session.maxQuestions,
      poolSize: session.characters.length,
    },
  })
}
