/**
 * GET /api/admin/confusion — confusion matrix.
 *
 * Source is selected via `?source=real|sim` (default `real`):
 *
 *  - `real` reads from `character_confusions` (populated nightly by
 *    `scripts/aggregate-real-game-signals.ts` from `game_stats` losses joined
 *    to `game_reveals.actual_character_id`). Pairs are stored canonically with
 *    `character_a < character_b`, so they are *undirected* and `winPct` is null.
 *
 *  - `sim` reads from `sim_game_stats` (target / second-best). Pairs are
 *    *directed* and carry a meaningful `winPct`.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import {
  formatRealPair,
  formatSimPair,
  parseConfusionParams,
  type ConfusionPair,
  type ConfusionSource,
  type RealConfusionRow,
  type SimConfusionRow,
} from './_confusion'

interface ConfusionResponse {
  source: ConfusionSource
  pairs: ConfusionPair[]
  total: number
  generatedAt: number
  message?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const { source, limit, minConfusions } = parseConfusionParams(url.searchParams)
  const generatedAt = Date.now()

  if (source === 'real') {
    const total = await db
      .prepare('SELECT COUNT(*) AS n FROM character_confusions')
      .first<{ n: number }>()

    if (!total?.n) {
      const body: ConfusionResponse = {
        source,
        pairs: [],
        total: 0,
        generatedAt,
        message: 'No real-game confusion data yet — the nightly aggregator will populate this once losses accumulate.',
      }
      return jsonResponse(body)
    }

    const rows = await db
      .prepare(
        `SELECT
           cc.character_a    AS character_a,
           cc.character_b    AS character_b,
           ca.name           AS name_a,
           cb.name           AS name_b,
           cc.confusion_count AS confusion_count,
           cc.last_seen      AS last_seen
         FROM character_confusions cc
         LEFT JOIN characters ca ON ca.id = cc.character_a
         LEFT JOIN characters cb ON cb.id = cc.character_b
         WHERE cc.confusion_count >= ?
         ORDER BY cc.confusion_count DESC, cc.last_seen DESC
         LIMIT ?`
      )
      .bind(minConfusions, limit)
      .all<RealConfusionRow>()

    const body: ConfusionResponse = {
      source,
      pairs: (rows.results ?? []).map(formatRealPair),
      total: total.n,
      generatedAt,
    }
    return jsonResponse(body)
  }

  // source === 'sim'
  const total = await db
    .prepare('SELECT COUNT(*) AS n FROM sim_game_stats WHERE second_best_character_id IS NOT NULL')
    .first<{ n: number }>()

  if (!total?.n) {
    const body: ConfusionResponse = {
      source,
      pairs: [],
      total: 0,
      generatedAt,
      message: 'No simulation data. Run a simulation first.',
    }
    return jsonResponse(body)
  }

  const rows = await db
    .prepare(
      `SELECT
         target_character_id        AS targetId,
         target_character_name      AS targetName,
         second_best_character_id   AS confusedWithId,
         second_best_character_name AS confusedWithName,
         COUNT(*)                   AS confusionCount,
         ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winPct
       FROM sim_game_stats
       WHERE second_best_character_id IS NOT NULL
       GROUP BY target_character_id, second_best_character_id
       HAVING confusionCount >= ?
       ORDER BY confusionCount DESC
       LIMIT ?`
    )
    .bind(minConfusions, limit)
    .all<SimConfusionRow>()

  const body: ConfusionResponse = {
    source,
    pairs: (rows.results ?? []).map(formatSimPair),
    total: total.n,
    generatedAt,
  }
  return jsonResponse(body)
}
