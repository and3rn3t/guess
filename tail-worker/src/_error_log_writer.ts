/**
 * PI.3.b — error_logs writeback from the Tail Worker.
 *
 * Main-worker `logError` (functions/api/_helpers.ts) emits a structured
 * envelope via `console.error(JSON.stringify({kind:'guess_error_event', …}))`
 * when `ERROR_LOG_VIA_TAIL` is enabled. This module parses those envelopes
 * out of `event.logs[]` and batch-inserts them into D1 `error_logs`, freeing
 * the request hot path from the final D1 round-trip that PI.3 left behind.
 *
 * Pure functions exported for unit tests; the Tail handler wires them up
 * with the live `GUESS_DB` D1 binding.
 */

import type { TailTraceItem } from './_tail_metrics'

const ENVELOPE_KIND = 'guess_error_event'
const MESSAGE_MAX = 500
const TRIM_KEEP_LATEST = 1000

export interface ErrorLogEnvelope {
  kind: typeof ENVELOPE_KIND
  source: string
  level: 'error' | 'warn'
  message: string
  /** JSON-stringified context payload, or null when no extra detail. */
  detail: string | null
}

/** Subset of the D1Database surface we actually use — keeps tests trivial. */
export interface ErrorLogDb {
  prepare(sql: string): {
    bind(...values: unknown[]): object // returned object is opaque; we only feed it back into batch()
  }
  batch(statements: unknown[]): Promise<unknown>
}

/**
 * Best-effort extraction of a string payload from a single tail log entry.
 * Cloudflare delivers `console.error(str)` as `{ level: 'error', message: [str] }`
 * in practice, but historical traces have shown plain strings and arrays of
 * mixed types — handle all of them without throwing.
 */
function logEntryToString(entry: { level?: string; message?: unknown }): string | null {
  const msg = entry.message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) {
    const first = msg.find((part) => typeof part === 'string')
    if (typeof first === 'string') return first
    return null
  }
  if (msg && typeof msg === 'object') {
    // Already-parsed JSON (some runtimes pre-parse) — re-stringify so parseEnvelope
    // can run a single code path.
    try {
      return JSON.stringify(msg)
    } catch {
      return null
    }
  }
  return null
}

/**
 * Pure: validate that an unknown blob matches the envelope contract.
 * Returns the envelope or null. Never throws.
 */
export function parseEnvelope(raw: string): ErrorLogEnvelope | null {
  // Cheap pre-check before paying for JSON.parse on every console line.
  if (!raw.includes(ENVELOPE_KIND)) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.kind !== ENVELOPE_KIND) return null
  if (typeof v.source !== 'string' || v.source.length === 0) return null
  if (v.level !== 'error' && v.level !== 'warn') return null
  if (typeof v.message !== 'string') return null
  const detail =
    v.detail === null || v.detail === undefined
      ? null
      : typeof v.detail === 'string'
        ? v.detail
        : null
  return {
    kind: ENVELOPE_KIND,
    source: v.source,
    level: v.level,
    message: v.message.slice(0, MESSAGE_MAX),
    detail,
  }
}

/** Extract every error-log envelope from a single trace item. */
export function extractEnvelopes(item: TailTraceItem): ErrorLogEnvelope[] {
  if (!item.logs || item.logs.length === 0) return []
  const out: ErrorLogEnvelope[] = []
  for (const entry of item.logs) {
    const str = logEntryToString(entry)
    if (!str) continue
    const env = parseEnvelope(str)
    if (env) out.push(env)
  }
  return out
}

/** Extract envelopes across an entire tail batch. */
export function extractEnvelopesFromBatch(items: TailTraceItem[]): ErrorLogEnvelope[] {
  const all: ErrorLogEnvelope[] = []
  for (const item of items) {
    const envs = extractEnvelopes(item)
    if (envs.length > 0) all.push(...envs)
  }
  return all
}

/**
 * Persist a set of envelopes to D1. Mirrors the SQL contract previously owned
 * by `logError` in functions/api/_helpers.ts (INSERT + trim-to-latest-1000).
 *
 * Fire-and-forget at the call site — caller is responsible for awaiting / wrapping
 * in `context.waitUntil`. Never throws.
 */
export async function writeErrorLogs(
  db: ErrorLogDb | undefined | null,
  envelopes: ErrorLogEnvelope[]
): Promise<number> {
  if (!db || typeof db.prepare !== 'function' || envelopes.length === 0) return 0
  try {
    const statements: unknown[] = envelopes.map((env) =>
      db
        .prepare('INSERT INTO error_logs (level, source, message, detail) VALUES (?, ?, ?, ?)')
        .bind(env.level, env.source, env.message, env.detail)
    )
    // Single trim per batch — the row count delta is bounded by envelopes.length.
    statements.push(
      db
        .prepare(
          `DELETE FROM error_logs WHERE id NOT IN (SELECT id FROM error_logs ORDER BY id DESC LIMIT ${TRIM_KEEP_LATEST})`
        )
        .bind()
    )
    await db.batch(statements)
    return envelopes.length
  } catch {
    // Telemetry is fire-and-forget — never re-throw onto the Tail Worker.
    return 0
  }
}
