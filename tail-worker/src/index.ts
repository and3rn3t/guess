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

import { writeTailEvents, type TailTraceItem } from './_tail_metrics'

interface Env {
  WORKER_TAIL?: {
    writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
  }
}

export default {
  tail(events: TailTraceItem[], env: Env): void {
    writeTailEvents(env.WORKER_TAIL, events)
  },
}
