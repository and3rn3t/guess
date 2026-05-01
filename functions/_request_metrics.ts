/**
 * Inline request-level telemetry for the Pages Function (I.4 fallback).
 *
 * Cloudflare Pages doesn't currently support `tail_consumers`, so instead
 * of attaching a Tail Worker we build the same Analytics Engine data point
 * inline from the middleware. The schema mirrors `tail-worker/src/_tail_metrics.ts`
 * so dashboards / SQL queries don't have to know which path produced the row.
 *
 * Schema:
 *   blobs[0]  = scriptName        ("guess-pages")
 *   blobs[1]  = path              (URL pathname)
 *   blobs[2]  = method            ("GET", "POST", …)
 *   blobs[3]  = outcome           ("ok" | "exception" | "client_error" | "server_error")
 *   blobs[4]  = errorMessage      (truncated, "" if none)
 *   blobs[5]  = trigger           ("fetch")
 *   doubles[0] = status           (HTTP status)
 *   doubles[1] = cpuMs            (always 0 — not available outside Tail)
 *   doubles[2] = wallMs           (Date.now() delta around next())
 *   doubles[3] = logCount         (always 0 — not available outside Tail)
 *   doubles[4] = exceptionCount   (0 or 1)
 *   indexes[0] = path             (sampling key — keeps per-route queries cheap)
 */

export interface AnalyticsEngineDataPoint {
  blobs?: string[]
  doubles?: number[]
  indexes?: string[]
}

export interface AnalyticsEngineDataset {
  writeDataPoint(point: AnalyticsEngineDataPoint): void
}

export interface RequestMetricsInput {
  scriptName?: string
  path: string
  method: string
  status: number
  wallMs: number
  errorMessage?: string
}

const MAX_ERROR_LEN = 200

function classifyOutcome(status: number, hasError: boolean): string {
  if (hasError) return 'exception'
  if (status >= 500) return 'server_error'
  if (status >= 400) return 'client_error'
  return 'ok'
}

/** Pure — exported for tests. */
export function buildRequestDataPoint(input: RequestMetricsInput): AnalyticsEngineDataPoint {
  const errorMessage = (input.errorMessage ?? '').slice(0, MAX_ERROR_LEN)
  const outcome = classifyOutcome(input.status, Boolean(input.errorMessage))
  return {
    blobs: [
      input.scriptName ?? 'guess-pages',
      input.path,
      input.method,
      outcome,
      errorMessage,
      'fetch',
    ],
    doubles: [
      input.status,
      0,
      Math.max(0, Math.round(input.wallMs)),
      0,
      input.errorMessage ? 1 : 0,
    ],
    indexes: [input.path || 'unknown'],
  }
}

/** Fire-and-forget AE write. No-ops cleanly when binding is absent. */
export function recordRequest(
  dataset: AnalyticsEngineDataset | undefined,
  input: RequestMetricsInput
): void {
  if (!dataset) return
  try {
    dataset.writeDataPoint(buildRequestDataPoint(input))
  } catch {
    // Telemetry must never fail a user request.
  }
}
