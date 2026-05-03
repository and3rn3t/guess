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
 * The handler logs the trigger for `wrangler tail` visibility and runs
 * isolated nightly maintenance workloads.
 *
 * Wave 2 consumers (DQ.6 nightly attribute reconciliation, DQ.22 sparse-attribute
 * auto-fill) will land their workloads as cases inside `runScheduled` keyed off
 * `event.cron`.
 */

import { runAnomalyCheck, type AnomalyEnv } from './_anomaly_check'
import { runAdminAutomation, type AutomationEnv } from './_automation'

export interface CronEnv extends AnomalyEnv, AutomationEnv {}

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
  env: CronEnv,
  log: (msg: unknown) => void = console.log,
): Promise<void> {
  log({
    event: 'cron.tick',
    cron: trigger.cron,
    scheduledTime: new Date(trigger.scheduledTime).toISOString(),
  })

  // AN.33 — nightly anomaly check on the daily_quality_snapshots series.
  // Runs on every scheduled tick; harmless when there isn't enough history.
  try {
    const summary = await runAnomalyCheck(env, log)
    log({ event: 'cron.anomaly_check', ...summary })
  } catch (err) {
    log({ event: 'cron.anomaly_check_failed', error: (err as Error).message })
  }

  try {
    await runAdminAutomation(trigger, env, log)
  } catch (err) {
    log({ event: 'cron.automation_failed', error: (err as Error).message })
  }
}

const handler: ExportedHandler<CronEnv> = {
  scheduled(event, env, ctx): void {
    ctx.waitUntil(runScheduled({ cron: event.cron, scheduledTime: event.scheduledTime }, env))
  },
}

export default handler
