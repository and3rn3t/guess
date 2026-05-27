/**
 * Tail Worker for the `guess` Pages Function (I.4).
 *
 * Cloudflare invokes this Worker once per main-Worker invocation with the
 * trace events for that invocation. We translate each into a single Workers
 * Analytics Engine data point so latency / error / cpu metrics are queryable
 * via SQL in the dashboard without touching the hot path.
 *
 * Deploy: `wrangler deploy --config tail-worker/wrangler.toml`
 * Connect to main: `tail_consumers` block in the root `wrangler.toml`
 * (Pages Functions read this on next deploy).
 */

import {
  extractEnvelopesFromBatch,
  writeErrorLogs,
  type ErrorLogDb,
} from './_error_log_writer'
import { writeTailEvents, type TailTraceItem } from './_tail_metrics'

interface Env {
  WORKER_TAIL?: {
    writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
  }
  /**
   * D1 binding for PI.3.b error_logs writeback. Optional so the worker still
   * boots in environments that haven't enabled the binding yet (e.g. local
   * `wrangler dev` without `--remote`).
   */
  GUESS_DB?: ErrorLogDb
}

interface TailContext {
  waitUntil?(promise: Promise<unknown>): void
}

export default {
  tail(events: TailTraceItem[], env: Env, ctx?: TailContext): void {
    writeTailEvents(env.WORKER_TAIL, events)

    // PI.3.b — drain `guess_error_event` envelopes out of the trace logs and
    // batch-insert into D1. Synchronous extract (pure), async write fire-and-
    // forget via ctx.waitUntil so the tail handler stays non-blocking.
    const envelopes = extractEnvelopesFromBatch(events)
    if (envelopes.length === 0 || !env.GUESS_DB) return
    const promise = writeErrorLogs(env.GUESS_DB, envelopes)
    if (ctx?.waitUntil) {
      ctx.waitUntil(promise)
    } else {
      // Fallback for older runtimes — still fire-and-forget, just no lifecycle hook.
      void promise
    }
  },
}
