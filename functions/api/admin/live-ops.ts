/**
 * GET /api/admin/live-ops — AN.30 rolling-1h health snapshot.
 *
 * Source-of-truth for the live ops strip in the admin header. Cheap (5 D1
 * COUNT(*) queries + an optional AE SQL call); intended to be polled every
 * 30s from the client.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import {
  buildLiveOpsSummary,
  buildP95LatencyQuery,
  buildTelemetryErrorsQuery,
  parseP95LatencyResponse,
  parseTelemetryErrorsResponse,
  type LiveOpsRow,
} from './_live_ops'

interface LiveOpsEnv extends Env {
  /** Cloudflare account ID (also embedded in CLOUDFLARE_AI_GATEWAY URL). */
  CF_ACCOUNT_ID?: string
  /** API token with `Account → Account Analytics → Read` permission. */
  CF_API_TOKEN?: string
  /**
   * AE dataset name to query for p95 latency. Defaults to the prod dataset
   * declared in wrangler.toml so the same code works in preview without
   * extra config (preview env binds `worker_tail_preview`).
   */
  WORKER_TAIL_DATASET?: string
}

const ONE_HOUR_SECONDS = 60 * 60

export const onRequestGet: PagesFunction<LiveOpsEnv> = async (context) => {
  const { env } = context
  const db = env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const cutoff = Math.floor(Date.now() / 1000) - ONE_HOUR_SECONDS

  const [gamesRow, errorsRow] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS games,
           COALESCE(SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END), 0) AS wins
         FROM game_stats
         WHERE created_at >= ?`,
      )
      .bind(cutoff)
      .first<{ games: number; wins: number }>(),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END), 0) AS errors,
           COALESCE(SUM(CASE WHEN level = 'warn'  THEN 1 ELSE 0 END), 0) AS warns
         FROM error_logs
         WHERE created_at >= ?`,
      )
      .bind(cutoff * 1000) // error_logs.created_at is ms, not seconds
      .first<{ errors: number; warns: number }>(),
  ])

  const counts: LiveOpsRow = {
    games1h: gamesRow?.games ?? 0,
    wins1h: gamesRow?.wins ?? 0,
    errors1h: errorsRow?.errors ?? 0,
    warns1h: errorsRow?.warns ?? 0,
  }

  const [p95, telemetryErrors1h] = await Promise.all([
    fetchP95Latency(env),
    fetchTelemetryErrors(env),
  ])
  const summary = buildLiveOpsSummary(counts, p95, undefined, telemetryErrors1h)

  // Don't allow shared caches to serve a 30s-stale snapshot to multiple admins.
  const response = jsonResponse(summary, 200)
  response.headers.set('cache-control', 'private, max-age=15')
  return response
}

async function fetchP95Latency(env: LiveOpsEnv): Promise<number | null> {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return null
  const dataset = env.WORKER_TAIL_DATASET ?? 'worker_tail'
  const sql = buildP95LatencyQuery(dataset, 60)
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: sql,
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as unknown
    return parseP95LatencyResponse(json)
  } catch {
    return null
  }
}

async function fetchTelemetryErrors(env: LiveOpsEnv): Promise<number | null> {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return null
  const dataset = env.WORKER_TAIL_DATASET ?? 'worker_tail'
  const sql = buildTelemetryErrorsQuery(dataset, 60)
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: sql,
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as unknown
    return parseTelemetryErrorsResponse(json)
  } catch {
    return null
  }
}
