/**
 * AN.30 — Live ops strip pure logic.
 *
 * Splits the data layer (D1 queries + optional Workers Analytics Engine SQL
 * query for latency) from the request handler so the math/serialization is
 * unit-testable without a live Cloudflare environment.
 */

export interface LiveOpsCounts {
  /** Number of completed games in the last 1h. */
  games1h: number
  /** Number of wins in the last 1h. */
  wins1h: number
  /** Number of losses in the last 1h (games where won = 0). */
  losses1h: number
  /** Number of error_logs rows with level='error' in the last 1h. */
  errors1h: number
  /** Number of error_logs rows with level='warn' in the last 1h. */
  warns1h: number
}

export interface LiveOpsSummary extends LiveOpsCounts {
  /** Games per minute over the last hour (rolling, 2 decimal places). */
  gamesPerMin: number
  /** Win rate over the last hour as a [0, 1] fraction; null when games1h=0. */
  winRate: number | null
  /** Errors per minute over the last hour. */
  errorsPerMin: number
  /**
   * Error rate per game (errors1h / games1h). Null when no games to avoid
   * division-by-zero noise; UI renders "—" in that case.
   */
  errorRate: number | null
  /**
   * P95 request latency in ms over the last hour. Null when AE query not
   * configured (CF_ACCOUNT_ID + CF_API_TOKEN absent), or when the dataset
   * has no rows yet, or when the query fails.
   */
  p95LatencyMs: number | null
  /** UNIX seconds when this snapshot was assembled. */
  generatedAt: number
}

export interface LiveOpsRow {
  /** From `SELECT COUNT(*) ... FROM game_stats WHERE created_at >= now-1h`. */
  games1h: number
  wins1h: number
  errors1h: number
  warns1h: number
}

/**
 * Pure aggregator: turn raw D1 counts + optional AE p95 into the summary shape
 * the admin UI consumes. Centralized so the rounding rules and null-handling
 * are tested once.
 */
export function buildLiveOpsSummary(
  raw: LiveOpsRow,
  p95LatencyMs: number | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): LiveOpsSummary {
  const games1h = Math.max(0, raw.games1h | 0)
  const wins1h = Math.max(0, Math.min(games1h, raw.wins1h | 0))
  const losses1h = games1h - wins1h
  const errors1h = Math.max(0, raw.errors1h | 0)
  const warns1h = Math.max(0, raw.warns1h | 0)

  const gamesPerMin = round2(games1h / 60)
  const errorsPerMin = round2(errors1h / 60)
  const winRate = games1h > 0 ? round4(wins1h / games1h) : null
  const errorRate = games1h > 0 ? round4(errors1h / games1h) : null

  return {
    games1h,
    wins1h,
    losses1h,
    errors1h,
    warns1h,
    gamesPerMin,
    errorsPerMin,
    winRate,
    errorRate,
    p95LatencyMs: p95LatencyMs == null ? null : Math.max(0, Math.round(p95LatencyMs)),
    generatedAt: nowSeconds,
  }
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10000) / 10000
}

/**
 * Build the Workers Analytics Engine SQL query for p95 wall-clock latency
 * over the last `windowMinutes` against the I.4 `worker_tail` dataset.
 * Filters out exception rows so a spike of 500s with no real latency doesn't
 * skew the percentile.
 */
export function buildP95LatencyQuery(dataset: string, windowMinutes = 60): string {
  // double2 = wallMs (see functions/_request_metrics.ts schema).
  // blob4 = outcome ('ok' | 'client_error' | 'server_error' | 'exception').
  return `SELECT quantileWeighted(0.95, double2, _sample_interval) AS p95
FROM ${dataset}
WHERE timestamp > NOW() - INTERVAL '${windowMinutes}' MINUTE
  AND blob4 != 'exception'`
}

/**
 * Parse the AE SQL response shape.
 *
 * AE returns either `{ data: [{ p95: number }], ... }` or, when the dataset
 * is empty, `{ data: [{ p95: null }] }`. Errors return `{ errors: [...] }`.
 */
export function parseP95LatencyResponse(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const data = obj['data']
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0] as Record<string, unknown> | undefined
  const p95 = first?.['p95']
  if (typeof p95 !== 'number' || !Number.isFinite(p95)) return null
  return p95
}
