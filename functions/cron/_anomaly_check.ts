/// <reference types="@cloudflare/workers-types" />
/**
 * AN.33 — Nightly anomaly check.
 *
 * Reads the last 15 daily snapshots from `data_quality_snapshots`, treats the
 * most recent row as "today", computes a 14-day baseline (mean ± 2σ) per
 * tracked metric, and writes one `alerts` row per crossing. When
 * `ALERTS_WEBHOOK_URL` is set the row is also POSTed to the webhook
 * (Slack/Discord-compatible `{ text }` payload). Webhook failures don't fail
 * the cron run — they're recorded inline on the alert row.
 *
 * Pure logic lives in `_anomaly_detector.ts`; this file is the I/O glue.
 */

import {
  computeBaseline,
  detectAnomaly,
  formatWebhookPayload,
  type Anomaly,
} from './_anomaly_detector'

export interface AnomalyEnv {
  GUESS_DB?: D1Database
  ALERTS_WEBHOOK_URL?: string
  ALERTS_DASHBOARD_URL?: string
}

interface SnapshotRow {
  data_health_score: number | null
  coverage_pct: number | null
  evidence_pct: number | null
  agreement_avg: number | null
  open_disputes: number | null
}

/** Metrics monitored for anomalies. Order = stable alert order. */
export const TRACKED_METRICS = [
  'data_health_score',
  'coverage_pct',
  'evidence_pct',
  'agreement_avg',
  'open_disputes',
] as const

export type TrackedMetric = (typeof TRACKED_METRICS)[number]

export interface AnomalyCheckResult {
  scanned: number
  alerts: number
  webhookSent: number
  webhookFailed: number
  webhookSkipped: number
}

/**
 * Run the full anomaly check. Safe to invoke repeatedly — duplicates within
 * the same day are still recorded (the table records every detected
 * crossing) but the webhook still posts at most once per metric per call.
 */
export async function runAnomalyCheck(
  env: AnomalyEnv,
  log: (msg: unknown) => void = console.log,
): Promise<AnomalyCheckResult> {
  const result: AnomalyCheckResult = {
    scanned: 0,
    alerts: 0,
    webhookSent: 0,
    webhookFailed: 0,
    webhookSkipped: 0,
  }

  if (!env.GUESS_DB) {
    log({ event: 'anomaly.skip', reason: 'no_db' })
    return result
  }

  const rows = await env.GUESS_DB.prepare(
    `SELECT data_health_score, coverage_pct, evidence_pct, agreement_avg, open_disputes
       FROM data_quality_snapshots
   ORDER BY captured_at DESC
      LIMIT 15`,
  ).all<SnapshotRow>()

  const data = rows.results ?? []
  if (data.length < 8) {
    // 7 baseline samples + 1 today is the minimum for the detector
    log({ event: 'anomaly.skip', reason: 'insufficient_history', have: data.length })
    return result
  }

  const today = data[0]
  const history = data.slice(1)
  result.scanned = TRACKED_METRICS.length

  for (const metric of TRACKED_METRICS) {
    const todayValue = numeric(today[metric])
    if (todayValue == null) continue
    const baselineValues = history
      .map((row) => numeric(row[metric]))
      .filter((v): v is number => v != null)

    const baseline = computeBaseline(baselineValues)
    const anomaly = detectAnomaly(todayValue, baseline)
    if (!anomaly) continue

    result.alerts += 1
    const webhookOutcome = await postWebhook(env, metric, anomaly, log)
    if (webhookOutcome.status === 'sent') result.webhookSent += 1
    if (webhookOutcome.status === 'failed') result.webhookFailed += 1
    if (webhookOutcome.status === 'skipped') result.webhookSkipped += 1

    await env.GUESS_DB.prepare(
      `INSERT INTO alerts (
          metric, value, baseline_mean, baseline_std,
          delta, z_score, direction, sample_size,
          webhook_status, webhook_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        metric,
        anomaly.value,
        anomaly.baseline.mean,
        anomaly.baseline.std,
        anomaly.delta,
        anomaly.zScore,
        anomaly.direction,
        anomaly.baseline.count,
        webhookOutcome.status,
        webhookOutcome.error ?? null,
      )
      .run()

    log({
      event: 'anomaly.detected',
      metric,
      value: anomaly.value,
      mean: anomaly.baseline.mean,
      std: anomaly.baseline.std,
      zScore: anomaly.zScore,
      direction: anomaly.direction,
      webhook: webhookOutcome.status,
    })
  }

  return result
}

interface WebhookOutcome {
  status: 'sent' | 'failed' | 'skipped'
  error?: string
}

async function postWebhook(
  env: AnomalyEnv,
  metric: TrackedMetric,
  anomaly: Anomaly,
  log: (msg: unknown) => void,
): Promise<WebhookOutcome> {
  if (!env.ALERTS_WEBHOOK_URL) return { status: 'skipped' }

  const payload = formatWebhookPayload({
    metric,
    anomaly,
    dashboardUrl: env.ALERTS_DASHBOARD_URL,
  })

  try {
    const res = await fetch(env.ALERTS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = `HTTP ${res.status}`
      log({ event: 'anomaly.webhook_failed', metric, error: err })
      return { status: 'failed', error: err }
    }
    return { status: 'sent' }
  } catch (err) {
    const message = (err as Error).message
    log({ event: 'anomaly.webhook_failed', metric, error: message })
    return { status: 'failed', error: message }
  }
}

function numeric(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
