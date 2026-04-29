/**
 * GET /api/admin/funnel — question-skip and game-abandon analytics.
 *
 * Powers the AN.1 funnel view in the admin panel. Reads from `client_events`
 * (populated by /api/v2/events) and joins to `questions` for human-readable
 * labels on the skip leaderboard.
 *
 * Window: last 30 days. Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

interface CountRow { n: number }
interface DailyRow { day: string; starts: number; ends: number; abandons: number; skips: number }
interface SkipLeaderRow { question_id: string; text: string | null; skips: number; avg_questions_asked: number | null }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const since = `unixepoch('now', '-30 days') * 1000`

  const [totals, daily, leaderboard] = await Promise.all([
    db.prepare(`
      SELECT
        SUM(CASE WHEN event_type = 'game_start' THEN 1 ELSE 0 END) AS starts,
        SUM(CASE WHEN event_type = 'game_end' THEN 1 ELSE 0 END) AS ends,
        SUM(CASE WHEN event_type = 'game_abandon' THEN 1 ELSE 0 END) AS abandons,
        SUM(CASE WHEN event_type = 'question_skip' THEN 1 ELSE 0 END) AS skips
      FROM client_events
      WHERE created_at >= ${since}
        AND event_type IN ('game_start','game_end','game_abandon','question_skip')
    `).first<{ starts: number; ends: number; abandons: number; skips: number }>(),

    db.prepare(`
      SELECT
        date(created_at / 1000, 'unixepoch') AS day,
        SUM(CASE WHEN event_type = 'game_start' THEN 1 ELSE 0 END) AS starts,
        SUM(CASE WHEN event_type = 'game_end' THEN 1 ELSE 0 END) AS ends,
        SUM(CASE WHEN event_type = 'game_abandon' THEN 1 ELSE 0 END) AS abandons,
        SUM(CASE WHEN event_type = 'question_skip' THEN 1 ELSE 0 END) AS skips
      FROM client_events
      WHERE created_at >= ${since}
        AND event_type IN ('game_start','game_end','game_abandon','question_skip')
      GROUP BY day
      ORDER BY day ASC
    `).all<DailyRow>(),

    // Per-question skip leaderboard. `data` is JSON; we extract questionId
    // via json_extract. LEFT JOIN to questions so unknown IDs still appear.
    db.prepare(`
      SELECT
        json_extract(ce.data, '$.questionId') AS question_id,
        q.text AS text,
        COUNT(*) AS skips,
        AVG(CAST(json_extract(ce.data, '$.questionsAsked') AS INTEGER)) AS avg_questions_asked
      FROM client_events ce
      LEFT JOIN questions q ON q.id = json_extract(ce.data, '$.questionId')
      WHERE ce.event_type = 'question_skip'
        AND ce.created_at >= ${since}
        AND json_extract(ce.data, '$.questionId') IS NOT NULL
      GROUP BY question_id
      ORDER BY skips DESC
      LIMIT 20
    `).all<SkipLeaderRow>(),

    // Sanity row to confirm the window has data at all
    db.prepare(`SELECT COUNT(*) AS n FROM client_events WHERE created_at >= ${since}`)
      .first<CountRow>(),
  ])

  const starts = totals?.starts ?? 0
  const ends = totals?.ends ?? 0
  const abandons = totals?.abandons ?? 0
  const skips = totals?.skips ?? 0

  return jsonResponse({
    windowDays: 30,
    totals: {
      gameStarts: starts,
      gameEnds: ends,
      gameAbandons: abandons,
      questionSkips: skips,
      completionRate: starts > 0 ? ends / starts : 0,
      abandonRate: starts > 0 ? abandons / starts : 0,
      avgSkipsPerGame: starts > 0 ? skips / starts : 0,
    },
    daily: daily.results ?? [],
    skipLeaderboard: leaderboard.results ?? [],
  })
}
