/// <reference types="@cloudflare/workers-types" />
/**
 * H.3 — Nightly Cron Worker entry.
 *
 * Pages Functions don't read `[triggers]` from `wrangler.toml`; Cron Triggers
 * for a Pages project must be enabled via the Cloudflare dashboard
 * (Workers & Pages → guess → Settings → Triggers → Add Cron Trigger).
 * Schedule: `5 0 * * *` (00:05 UTC nightly) — matches the `daily_stats` rollup
 * window in planned migration 0036, the `info_gain_avg` EMA update, and the
 * future `feature_flags` D1→KV sync.
 *
 * Until those consumers ship, this handler is a no-op that logs the trigger
 * for `wrangler tail` visibility (the H.3 acceptance criterion).
 *
 * Wave 2 consumers (DQ.6 nightly attribute reconciliation, DQ.22 sparse-attribute
 * auto-fill) will land their workloads as cases inside `runScheduled` keyed off
 * `event.cron`.
 */

export interface CronEnv {
  GUESS_KV?: KVNamespace
  GUESS_DB?: D1Database
}

export interface ScheduledTrigger {
  cron: string
  scheduledTime: number
}

/**
 * Pure dispatcher — exported separately from the runtime entry point so it can
 * be unit-tested without mocking the Cloudflare runtime.
 */
export async function runScheduled(
  trigger: ScheduledTrigger,
  _env: CronEnv,
  log: (msg: unknown) => void = console.log,
): Promise<void> {
  log({
    event: 'cron.tick',
    cron: trigger.cron,
    scheduledTime: new Date(trigger.scheduledTime).toISOString(),
  })

  // Wave 2 consumers will branch on `trigger.cron` here, e.g.:
  //   if (trigger.cron === '5 0 * * *') { await rollupDailyStats(env) }
}

const handler: ExportedHandler<CronEnv> = {
  scheduled(event, env, ctx): void {
    ctx.waitUntil(runScheduled({ cron: event.cron, scheduledTime: event.scheduledTime }, env))
  },
}

export default handler
