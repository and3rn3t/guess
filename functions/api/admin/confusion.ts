/**
 * GET /api/admin/confusion — confusion matrix from sim_game_stats.
 *
 * Returns pairs of (target, second_best) with confusion count and win rate.
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const limit = Math.min(200, Math.max(5, parseInt(url.searchParams.get('limit') ?? '50', 10)))
  const minConfusions = Math.max(1, parseInt(url.searchParams.get('minConfusions') ?? '2', 10))

  // Check if sim_game_stats has any data
  const total = await db
    .prepare('SELECT COUNT(*) AS n FROM sim_game_stats WHERE second_best_character_id IS NOT NULL')
    .first<{ n: number }>()

  if (!total?.n) {
    return jsonResponse({ pairs: [], total: 0, message: 'No simulation data. Run a simulation first.' })
  }

  // Top confused pairs
  const rows = await db
    .prepare(
      `SELECT
         target_character_id AS targetId,
         target_character_name AS targetName,
         second_best_character_id AS confusedWithId,
         second_best_character_name AS confusedWithName,
         COUNT(*) AS confusionCount,
         ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winPct
       FROM sim_game_stats
       WHERE second_best_character_id IS NOT NULL
       GROUP BY target_character_id, second_best_character_id
       HAVING confusionCount >= ?
       ORDER BY confusionCount DESC
       LIMIT ?`
    )
    .bind(minConfusions, limit)
    .all<{
      targetId: string
      targetName: string
      confusedWithId: string
      confusedWithName: string
      confusionCount: number
      winPct: number
    }>()

  return jsonResponse({ pairs: rows.results ?? [], total: total.n })
}
