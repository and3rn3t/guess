/**
 * GET /api/admin/stress-test — aggregate stress test stats from sim_game_stats.
 *
 * Returns win rates, hardest characters, difficulty breakdown, and recent runs.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const total = await db
    .prepare('SELECT COUNT(*) AS n FROM sim_game_stats')
    .first<{ n: number }>()

  if (!total?.n) {
    return jsonResponse({
      hasData: false,
      message: 'No simulation data. Run: pnpm simulate --all --write-db',
    })
  }

  const [summary, hardest, byDifficulty, recentRuns] = await Promise.all([
    // Overall summary
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winPct,
        ROUND(AVG(questions_asked), 1) AS avgQuestions,
        ROUND(AVG(confidence_at_guess), 3) AS avgConfidence
      FROM sim_game_stats
    `).first<{ total: number; winPct: number; avgQuestions: number; avgConfidence: number }>(),

    // Hardest characters to guess
    db.prepare(`
      SELECT
        target_character_id AS id,
        target_character_name AS name,
        COUNT(*) AS games,
        ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winPct,
        ROUND(AVG(questions_asked), 1) AS avgQuestions
      FROM sim_game_stats
      GROUP BY target_character_id
      HAVING games >= 3
      ORDER BY winPct ASC, avgQuestions DESC
      LIMIT 15
    `).all<{ id: string; name: string; games: number; winPct: number; avgQuestions: number }>(),

    // By difficulty
    db.prepare(`
      SELECT
        difficulty,
        COUNT(*) AS total,
        ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winPct,
        ROUND(AVG(questions_asked), 1) AS avgQuestions
      FROM sim_game_stats
      GROUP BY difficulty
      ORDER BY difficulty ASC
    `).all<{ difficulty: string; total: number; winPct: number; avgQuestions: number }>(),

    // Recent run IDs
    db.prepare(`
      SELECT
        run_id AS runId,
        COUNT(*) AS games,
        ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winPct,
        MIN(created_at) AS startedAt,
        difficulty
      FROM sim_game_stats
      GROUP BY run_id
      ORDER BY startedAt DESC
      LIMIT 10
    `).all<{ runId: string; games: number; winPct: number; startedAt: number; difficulty: string }>(),
  ])

  return jsonResponse({
    hasData: true,
    total: total.n,
    summary,
    hardest: hardest.results ?? [],
    byDifficulty: byDifficulty.results ?? [],
    recentRuns: recentRuns.results ?? [],
  })
}
