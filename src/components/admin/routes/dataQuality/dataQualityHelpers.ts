import type { HistoryRow, LiveSnapshot } from './dataQualityTypes'

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function fmtPctPrecise(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

export function fmtPp(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)} pp`
}

export function gateTone(snapshot: LiveSnapshot): {
  label: 'PASS' | 'WARN' | 'FAIL'
  className: string
  hint: string
} {
  const { gate } = snapshot.completeness
  if (gate.fail) {
    return {
      label: 'FAIL',
      className: 'border-destructive/40 bg-destructive/10 text-destructive',
      hint: 'Below fail threshold, below category floor, or disputes exceed budget.',
    }
  }
  if (gate.warn) {
    return {
      label: 'WARN',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      hint: 'Warn-only rollout is surfacing completeness drift before enforcement.',
    }
  }
  return {
    label: 'PASS',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    hint: 'Score, category floor, and dispute budget are all healthy.',
  }
}

export function toDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

export function relativeFromIso(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return 'unknown'
  const deltaMs = Math.max(0, Date.now() - ts)
  const mins = Math.floor(deltaMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatAutomationShareDelta(delta: number | null): string {
  return delta === null ? 'n/a' : fmtPp(delta)
}

export interface TrendSeriesData {
  goldenSeries: Array<{ day: string; value: number }>
  visionSeries: Array<{ day: string; value: number }>
  agreementSeries: Array<{ day: string; value: number }>
  disputeSeries: Array<{ day: string; value: number }>
  healthSeries: Array<{ day: string; value: number }>
  closureTotalSeries: Array<{ day: string; value: number }>
  closureAutomationSeries: Array<{ day: string; value: number }>
  closureManualSeries: Array<{ day: string; value: number }>
  closureLaneMixSeries: Array<{ day: string; automation: number; manual: number }>
  latestLaneMix: { day: string; automation: number; manual: number } | null
  automationShareDeltaPp: number | null
}

export function buildTrendSeries(history: HistoryRow[]): TrendSeriesData {
  const goldenSeries = history
    .filter((row): row is HistoryRow & { golden_pass_rate: number } => row.golden_pass_rate !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.golden_pass_rate }))
  const visionSeries = history
    .filter((row): row is HistoryRow & { vision_pass_rate: number } => row.vision_pass_rate !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.vision_pass_rate }))
  const agreementSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.agreement_avg }))
  const disputeSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.open_disputes }))
  const healthSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.data_health_score }))
  const closureTotalSeries = history
    .filter((row): row is HistoryRow & { closure_total_pairs: number } => row.closure_total_pairs !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.closure_total_pairs }))
  const closureAutomationSeries = history
    .filter((row): row is HistoryRow & { closure_automation_pairs: number } => row.closure_automation_pairs !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.closure_automation_pairs }))
  const closureManualSeries = history
    .filter((row): row is HistoryRow & { closure_manual_pairs: number } => row.closure_manual_pairs !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.closure_manual_pairs }))
  const closureLaneMixSeries = history
    .filter(
      (row): row is HistoryRow & {
        closure_total_pairs: number
        closure_automation_pairs: number
        closure_manual_pairs: number
      } =>
        row.closure_total_pairs !== null &&
        row.closure_total_pairs > 0 &&
        row.closure_automation_pairs !== null &&
        row.closure_manual_pairs !== null,
    )
    .map((row) => {
      const total = row.closure_total_pairs
      const automation = row.closure_automation_pairs / total
      const manual = row.closure_manual_pairs / total
      return {
        day: toDay(row.captured_at),
        automation,
        manual,
      }
    })
  const latestLaneMix = closureLaneMixSeries.at(-1) ?? null
  const previousLaneMix = closureLaneMixSeries.length > 1 ? (closureLaneMixSeries.at(-2) ?? null) : null
  const automationShareDeltaPp =
    latestLaneMix && previousLaneMix
      ? (latestLaneMix.automation - previousLaneMix.automation) * 100
      : null

  return {
    goldenSeries,
    visionSeries,
    agreementSeries,
    disputeSeries,
    healthSeries,
    closureTotalSeries,
    closureAutomationSeries,
    closureManualSeries,
    closureLaneMixSeries,
    latestLaneMix,
    automationShareDeltaPp,
  }
}
