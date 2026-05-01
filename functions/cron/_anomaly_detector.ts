/**
 * AN.33 — Anomaly detection logic.
 *
 * Pure functions, no I/O. The cron handler in `functions/cron/_anomaly_check.ts`
 * (and its test) exercise the I/O glue; this module owns the math + payload
 * formatting so it can be unit-tested without sqlite or fetch mocks.
 */

export interface Baseline {
  /** Sample mean of the prior window. */
  mean: number
  /** Sample standard deviation (n-1 denominator) of the prior window. */
  std: number
  /** Number of samples used. */
  count: number
}

export interface AnomalyOptions {
  /** Number of standard deviations either side of the mean that counts as normal. Default 2. */
  sigma?: number
  /** Minimum samples required to compute a baseline. Default 7. */
  minSamples?: number
}

export interface Anomaly {
  /** Today's value that crossed the band. */
  value: number
  baseline: Baseline
  /** value − mean (signed). */
  delta: number
  /** (value − mean) / std; 0 when std == 0. */
  zScore: number
  direction: 'above' | 'below'
}

/**
 * Compute mean + sample standard deviation of `values`. Returns `{ mean: 0,
 * std: 0, count: 0 }` when given an empty array. Non-finite values are
 * skipped.
 */
export function computeBaseline(values: readonly number[]): Baseline {
  const cleaned = values.filter((v) => Number.isFinite(v))
  const n = cleaned.length
  if (n === 0) return { mean: 0, std: 0, count: 0 }
  const mean = cleaned.reduce((sum, v) => sum + v, 0) / n
  if (n === 1) return { mean, std: 0, count: 1 }
  const variance = cleaned.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)
  return { mean, std: Math.sqrt(variance), count: n }
}

/**
 * Detect whether `value` falls outside `mean ± sigma·std` of the supplied
 * baseline. Returns null if the value is in band, the sample is too small,
 * or `value` is not finite.
 *
 * When std == 0 (all baseline samples identical) the threshold collapses to
 * the mean — any departure is an anomaly with zScore == 0 and a non-zero
 * delta (we cannot divide by zero meaningfully).
 */
export function detectAnomaly(
  value: number,
  baseline: Baseline,
  opts: AnomalyOptions = {},
): Anomaly | null {
  const sigma = opts.sigma ?? 2
  const minSamples = opts.minSamples ?? 7
  if (!Number.isFinite(value)) return null
  if (baseline.count < minSamples) return null

  const delta = value - baseline.mean
  if (baseline.std === 0) {
    if (delta === 0) return null
    return {
      value,
      baseline,
      delta,
      zScore: 0,
      direction: delta > 0 ? 'above' : 'below',
    }
  }

  const zScore = delta / baseline.std
  if (Math.abs(zScore) <= sigma) return null
  return {
    value,
    baseline,
    delta,
    zScore,
    direction: delta > 0 ? 'above' : 'below',
  }
}

export interface WebhookPayloadInput {
  metric: string
  anomaly: Anomaly
  /** Optional fully-qualified URL to a chart for this metric, included in the alert. */
  dashboardUrl?: string
}

/**
 * Slack/Discord-compatible JSON payload. Both platforms accept `{ text }` for
 * incoming-webhooks; richer formatting is platform-specific so we keep the
 * lowest common denominator.
 */
export function formatWebhookPayload({
  metric,
  anomaly,
  dashboardUrl,
}: WebhookPayloadInput): { text: string } {
  const arrow = anomaly.direction === 'above' ? '▲' : '▼'
  const z = anomaly.zScore.toFixed(2)
  const value = round4(anomaly.value)
  const mean = round4(anomaly.baseline.mean)
  const std = round4(anomaly.baseline.std)
  const lines = [
    `${arrow} *${metric}* anomaly: \`${value}\` (z=${z}, baseline ${mean} ± ${std}, n=${anomaly.baseline.count})`,
  ]
  if (dashboardUrl) lines.push(`<${dashboardUrl}|view chart>`)
  return { text: lines.join('\n') }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
