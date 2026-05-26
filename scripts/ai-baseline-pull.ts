#!/usr/bin/env tsx
/**
 * pnpm ai:baseline:pull — fill the remaining nulls in
 * data/ai-baseline-2026-05.json from the Cloudflare Analytics Engine SQL API.
 *
 * The AI Gateway dashboard UI no longer exposes per-route facet drill-down
 * or latency percentiles, but we own the data ourselves via two AE datasets:
 *
 *   - `llm_costs`   — written by `recordLLMUsage()` in functions/api/_llm_metrics.ts
 *                     on every LLM call (HIT and MISS).
 *                     blob1=model, blob2=userId, blob3=cacheStatus,
 *                     blob4=endpoint, blob5=retryOutcome
 *                     double1..3=prompt/completion/total tokens
 *                     double4=estCostUsd, double5=retryCount
 *
 *   - `worker_tail` — written by functions/_middleware.ts on every request.
 *                     blob1=scriptName, blob2=path, blob3=method, blob4=outcome,
 *                     blob5=errorMessage, blob6=trigger
 *                     double1=status, double2=cpuMs, double3=wallMs,
 *                     double4=logCount, double5=exceptionCount
 *                     index1=path
 *
 * Required env (sourced from .dev.vars / shell):
 *   CF_ACCOUNT_ID   — Cloudflare account ID
 *   CF_API_TOKEN    — token with `Account → Analytics Engine → Read` permission
 *
 * Optional:
 *   --window=30     — days to look back (default 30)
 *   --dry-run       — print queries + parsed results, don't write file
 *
 * Usage:
 *   pnpm ai:baseline:pull
 *   pnpm ai:baseline:pull -- --dry-run
 *   pnpm ai:baseline:pull -- --window=7
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASELINE_PATH = resolve(process.cwd(), 'data/ai-baseline-2026-05.json')
const SQL_ENDPOINT = (acct: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${acct}/analytics_engine/sql`

interface CliArgs {
  windowDays: number
  dryRun: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const windowArg = argv.find((a) => a.startsWith('--window='))
  const windowDays = windowArg ? parseInt(windowArg.split('=')[1], 10) : 30
  const dryRun = argv.includes('--dry-run')
  return { windowDays, dryRun }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`✗ missing required env: ${name}`)
    console.error('  source it from .dev.vars or your shell:')
    console.error(`    export ${name}=…`)
    process.exit(1)
  }
  return v
}

interface AESqlResponse {
  meta: Array<{ name: string; type: string }>
  data: Array<Record<string, unknown>>
  rows: number
}

async function runSql(account: string, token: string, sql: string): Promise<AESqlResponse> {
  const res = await fetch(SQL_ENDPOINT(account), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: sql,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`AE SQL ${res.status}: ${body.slice(0, 400)}`)
  }
  return (await res.json()) as AESqlResponse
}

function buildCostByRouteModelSql(days: number): string {
  // blob4 = endpoint, blob1 = model, blob3 = cacheStatus,
  // double4 = estCostUsd, double3 = totalTokens, _sample_interval expands sampling.
  return `
    SELECT
      blob4 AS endpoint,
      blob1 AS model,
      SUM(double4 * _sample_interval) AS usd_total,
      SUM(double3 * _sample_interval) AS tokens_total,
      SUM(_sample_interval)            AS requests,
      SUM(if(blob3 = 'HIT', _sample_interval, 0)) AS cache_hits
    FROM llm_costs
    WHERE timestamp > now() - INTERVAL '${days}' DAY
    GROUP BY endpoint, model
    ORDER BY usd_total DESC
    FORMAT JSON
  `.trim()
}

function buildLatencyByRouteSql(days: number): string {
  // blob2 = path, blob4 = outcome, double3 = wallMs
  return `
    SELECT
      blob2 AS path,
      quantileWeighted(0.50, double3, _sample_interval) AS p50_ms,
      quantileWeighted(0.95, double3, _sample_interval) AS p95_ms,
      quantileWeighted(0.99, double3, _sample_interval) AS p99_ms,
      SUM(_sample_interval) AS requests
    FROM worker_tail
    WHERE timestamp > now() - INTERVAL '${days}' DAY
      AND blob4 != 'exception'
      AND blob2 IN (
        '/api/llm',
        '/api/llm-stream',
        '/api/v2/game/answer',
        '/api/admin/questions/duplicates'
      )
    GROUP BY path
    ORDER BY requests DESC
    FORMAT JSON
  `.trim()
}

interface CostRow {
  endpoint: string
  model: string
  usd_total: number
  tokens_total: number
  requests: number
  cache_hits: number
}

interface LatencyRow {
  path: string
  p50_ms: number
  p95_ms: number
  p99_ms: number
  requests: number
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function round(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

async function main(): Promise<void> {
  const { windowDays, dryRun } = parseArgs(process.argv.slice(2))
  const account = requireEnv('CF_ACCOUNT_ID')
  const token = requireEnv('CF_API_TOKEN')

  console.log(`→ pulling AI baseline for last ${windowDays} days`)
  console.log(`  account: ${account.slice(0, 8)}…`)

  const costSql = buildCostByRouteModelSql(windowDays)
  const latSql = buildLatencyByRouteSql(windowDays)

  if (dryRun) {
    console.log('\n--- cost SQL ---\n' + costSql)
    console.log('\n--- latency SQL ---\n' + latSql)
  }

  console.log('\n→ querying llm_costs (cost by route × model)...')
  const costRes = await runSql(account, token, costSql)
  const costRows: CostRow[] = costRes.data.map((r) => ({
    endpoint: String(r.endpoint ?? 'unknown'),
    model: String(r.model ?? 'unknown'),
    usd_total: asNumber(r.usd_total),
    tokens_total: asNumber(r.tokens_total),
    requests: asNumber(r.requests),
    cache_hits: asNumber(r.cache_hits),
  }))
  console.log(`  ${costRows.length} (endpoint, model) rows`)
  for (const r of costRows.slice(0, 10)) {
    const hitRate = r.requests > 0 ? round((r.cache_hits / r.requests) * 100, 2) : 0
    console.log(
      `    ${r.endpoint.padEnd(28)} ${r.model.padEnd(18)} $${round(r.usd_total, 4).toString().padStart(8)} · ${r.requests} req · ${hitRate}% cached`,
    )
  }

  console.log('\n→ querying worker_tail (latency percentiles by route)...')
  const latRes = await runSql(account, token, latSql)
  const latRows: LatencyRow[] = latRes.data.map((r) => ({
    path: String(r.path ?? 'unknown'),
    p50_ms: asNumber(r.p50_ms),
    p95_ms: asNumber(r.p95_ms),
    p99_ms: asNumber(r.p99_ms),
    requests: asNumber(r.requests),
  }))
  console.log(`  ${latRows.length} route rows`)
  for (const r of latRows) {
    console.log(
      `    ${r.path.padEnd(40)} p50=${round(r.p50_ms)}ms p95=${round(r.p95_ms)}ms p99=${round(r.p99_ms)}ms (${r.requests} req)`,
    )
  }

  if (dryRun) {
    console.log('\n--dry-run; baseline file not modified')
    return
  }

  // Update the baseline file.
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, unknown>

  const costBlock: Record<string, unknown> = {}
  const cacheHitBlock: Record<string, number> = {}
  for (const r of costRows) {
    const key = `${r.endpoint}::${r.model}`
    costBlock[key] = {
      usd_total_window: round(r.usd_total, 4),
      usd_per_day_avg: round(r.usd_total / windowDays, 4),
      tokens_total_window: Math.round(r.tokens_total),
      requests: Math.round(r.requests),
      cache_hit_ratio: r.requests > 0 ? round(r.cache_hits / r.requests, 4) : 0,
    }
    cacheHitBlock[r.endpoint] = round((r.cache_hits / Math.max(r.requests, 1)), 4)
  }

  const latencyBlock: Record<string, { p50: number; p95: number; p99: number }> = {}
  for (const r of latRows) {
    latencyBlock[r.path] = {
      p50: round(r.p50_ms),
      p95: round(r.p95_ms),
      p99: round(r.p99_ms),
    }
  }

  // Merge: replace cost.daily_usd_by_route_model with real data,
  // populate gateway_cache.hit_ratio_by_route, latency_ms.by_route.
  const cost = (baseline.cost ?? {}) as Record<string, unknown>
  cost.daily_usd_by_route_model = {
    _window_days: windowDays,
    _source: 'AE SQL on llm_costs',
    _captured_at: new Date().toISOString(),
    by_endpoint_model: costBlock,
  }
  baseline.cost = cost

  const gwCache = (baseline.gateway_cache ?? {}) as Record<string, unknown>
  gwCache.hit_ratio_by_route = {
    _source: 'AE SQL on llm_costs (cacheStatus blob)',
    _captured_at: new Date().toISOString(),
    by_endpoint: cacheHitBlock,
  }
  baseline.gateway_cache = gwCache

  const lat = (baseline.latency_ms ?? {}) as Record<string, unknown>
  lat.by_route = latencyBlock
  lat._source = 'AE SQL on worker_tail (quantileWeighted of double3=wallMs)'
  lat._captured_at = new Date().toISOString()
  baseline.latency_ms = lat

  // Append a refresh_log entry.
  const log = (baseline.refresh_log ?? []) as Array<Record<string, unknown>>
  log.push({
    date: new Date().toISOString().slice(0, 10),
    phase: 'AI.0',
    note: `Pulled per-route cost + latency from AE SQL API (last ${windowDays}d). Cost: ${costRows.length} (endpoint, model) rows. Latency: ${latRows.length} hot-route rows. Dashboard UI drill-down no longer needed — script is rerunnable from .dev.vars.`,
  })
  baseline.refresh_log = log

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
  console.log(`\n✓ wrote ${BASELINE_PATH}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
