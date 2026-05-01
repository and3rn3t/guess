/**
 * Pure mapper: turn a single Cloudflare Tail `TraceItem` into one
 * Analytics Engine data point.
 *
 * Schema (deliberately small — AE caps at 6 blobs / 20 doubles / 1 index):
 *   blobs[0]  = scriptName        (e.g. "guess")
 *   blobs[1]  = path              (URL pathname, "" for non-fetch events)
 *   blobs[2]  = method            (e.g. "GET", "POST", "" for non-fetch)
 *   blobs[3]  = outcome           ("ok" | "exception" | "exceededCpu" | …)
 *   blobs[4]  = errorMessage      (first exception message, truncated)
 *   blobs[5]  = trigger           ("fetch" | "scheduled" | "queue" | "tail" | "rpc" | "unknown")
 *   doubles[0] = status           (HTTP status for fetch, 0 otherwise)
 *   doubles[1] = cpuMs            (event.cpuTime, milliseconds)
 *   doubles[2] = wallMs           (event.wallTime, milliseconds)
 *   doubles[3] = logCount         (event.logs.length)
 *   doubles[4] = exceptionCount   (event.exceptions.length)
 *   indexes[0] = path or scriptName (sampling key — keeps per-route queries cheap)
 *
 * Powers AN.29 (latency budget panel) and AN.30 (live ops strip).
 */

export interface AnalyticsEngineDataPoint {
  blobs?: string[]
  doubles?: number[]
  indexes?: string[]
}

export interface AnalyticsEngineDataset {
  writeDataPoint(point: AnalyticsEngineDataPoint): void
}

/** Subset of Cloudflare's `TraceItem` shape we actually consume. */
export interface TailTraceItem {
  scriptName?: string | null
  outcome?: string
  cpuTime?: number
  wallTime?: number
  logs?: Array<{ level?: string; message?: unknown }>
  exceptions?: Array<{ name?: string; message?: string; timestamp?: number }>
  event?:
    | {
        request?: {
          url?: string
          method?: string
        }
        response?: {
          status?: number
        }
      }
    | { cron?: string; scheduledTime?: number }
    | { queue?: string }
    | null
    | undefined
  eventTimestamp?: number | null
}

const MAX_ERROR_LEN = 200

function safePathname(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function classifyTrigger(event: TailTraceItem['event']): string {
  if (!event || typeof event !== 'object') return 'unknown'
  if ('request' in event && event.request) return 'fetch'
  if ('cron' in event && event.cron) return 'scheduled'
  if ('queue' in event && event.queue) return 'queue'
  return 'unknown'
}

function firstExceptionMessage(exceptions: TailTraceItem['exceptions']): string {
  if (!exceptions || exceptions.length === 0) return ''
  const first = exceptions[0]
  const msg = first?.message ?? first?.name ?? ''
  return String(msg).slice(0, MAX_ERROR_LEN)
}

/**
 * Build a single AE data point from a Tail event. Pure — exported for tests.
 */
export function buildTailDataPoint(item: TailTraceItem): AnalyticsEngineDataPoint {
  const trigger = classifyTrigger(item.event)
  const fetchEvent =
    item.event && typeof item.event === 'object' && 'request' in item.event
      ? item.event
      : null
  const path = safePathname(fetchEvent?.request?.url)
  const method = fetchEvent?.request?.method ?? ''
  const status = fetchEvent?.response?.status ?? 0
  const scriptName = item.scriptName ?? ''
  const samplingKey = path || scriptName || trigger

  return {
    blobs: [
      scriptName,
      path,
      method,
      item.outcome ?? '',
      firstExceptionMessage(item.exceptions),
      trigger,
    ],
    doubles: [
      status,
      item.cpuTime ?? 0,
      item.wallTime ?? 0,
      item.logs?.length ?? 0,
      item.exceptions?.length ?? 0,
    ],
    indexes: [samplingKey],
  }
}

/**
 * Write one data point per trace item. Catches per-item errors so a single
 * malformed trace can't drop the whole batch (Tail Workers receive arrays).
 */
export function writeTailEvents(
  dataset: AnalyticsEngineDataset | undefined,
  items: TailTraceItem[]
): number {
  if (!dataset || items.length === 0) return 0
  let written = 0
  for (const item of items) {
    try {
      dataset.writeDataPoint(buildTailDataPoint(item))
      written++
    } catch {
      // Telemetry is fire-and-forget — never re-throw.
    }
  }
  return written
}
