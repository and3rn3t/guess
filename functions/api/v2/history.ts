import {
  type Env,
  getOrCreateUserId,
  withSetCookie,
  jsonResponse,
  errorResponse,
  d1Query,
  d1First,
  logError,
} from '../_helpers'
import type { GameStatsRow } from '../_db-types'

// ── Types ────────────────────────────────────────────────────

type GameHistoryRow = Omit<GameStatsRow, 'user_id'>

// ── GET /api/v2/history ──────────────────────────────────────
// Returns the current user's game history from D1

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  const url = new URL(context.request.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)

  try {
    const [rows, total] = await Promise.all([
      d1Query<GameHistoryRow>(
        db,
        `SELECT id, won, difficulty, questions_asked, character_pool_size,
              character_id, character_name, steps, created_at
       FROM game_stats
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
        [userId, limit]
      ),
      d1First<{ count: number }>(
        db,
        'SELECT COUNT(*) as count FROM game_stats WHERE user_id = ?',
        [userId]
      ),
    ])

    const games = rows.map((row) => {
      let parsedSteps: Array<{ questionText: string; attribute: string; answer: string }> = []
      if (row.steps) {
        try {
          parsedSteps = JSON.parse(row.steps)
        } catch {
          // Malformed steps — skip
        }
      }

      return {
        id: String(row.id),
        characterId: row.character_id ?? 'unknown',
        characterName: row.character_name ?? 'Unknown',
        won: row.won === 1,
        difficulty: row.difficulty,
        questionsAsked: row.questions_asked,
        poolSize: row.character_pool_size,
        steps: parsedSteps,
        timestamp: row.created_at,
      }
    })

    return withSetCookie(jsonResponse({
      games,
      total: total?.count ?? games.length,
    }), setCookieHeader)
  } catch (e) {
    console.error('history GET error:', e)
    context.waitUntil(logError(context.env.GUESS_DB, 'history', 'error', 'history GET error', e))
    return errorResponse('Internal server error', 500)
  }
}
