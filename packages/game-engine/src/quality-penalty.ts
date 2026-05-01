/**
 * Question quality penalty (C.6) — pairs with AN.17 retirement queue.
 *
 * Engine-side counterpart to the admin retirement score. Same composite
 * (skipRate / maybeRate / answer-imbalance) but inverted into a multiplier
 * the question selector applies to `infoGain` so questions trending toward
 * retirement are picked less often *before* an admin pulls the trigger.
 *
 * Pure: no I/O, no globals. Same formula as `_retirement.ts` so the runtime
 * down-weighting matches what the admin sees in `/admin/questions/retire`.
 */

export interface QualitySignals {
  shown: number
  skipped: number
  yes: number
  no: number
  maybe: number
}

export interface QualityPenaltyOptions {
  /** Penalty strength: `multiplier = 1 - alpha × badnessScore`. Default 1. */
  alpha?: number
  /** Lower clamp so a "bad" question still gets some consideration. Default 0.3. */
  floor?: number
  /** Drop questions with fewer impressions than this from the map. Default 10. */
  minShown?: number
}

/**
 * Returns a multiplier in `[floor, 1]` to apply to the selector's `infoGain`.
 * `1.0` = no penalty; `floor` = maximum penalty (still selectable as last resort).
 * Returns `null` when there's not enough data to score the question — caller
 * should treat null as "no penalty" (1.0) rather than persisting it.
 */
export function computeQualityPenalty(
  signals: QualitySignals,
  opts: QualityPenaltyOptions = {},
): number | null {
  const alpha = opts.alpha ?? 1
  const floor = opts.floor ?? 0.3
  const minShown = opts.minShown ?? 10

  if (!Number.isFinite(signals.shown) || signals.shown < minShown) return null

  const totalImpressions = signals.shown + Math.max(0, signals.skipped)
  const skipRate = totalImpressions > 0 ? signals.skipped / totalImpressions : 0
  const maybeRate = signals.shown > 0 ? signals.maybe / signals.shown : 0
  const yesNo = signals.yes + signals.no
  const imbalance = yesNo > 0 ? Math.abs(0.5 - signals.yes / yesNo) * 2 : 0

  const badness = clamp01(0.4 * clamp01(skipRate) + 0.3 * clamp01(maybeRate) + 0.3 * clamp01(imbalance))
  const raw = 1 - alpha * badness
  const clamped = Math.max(floor, Math.min(1, raw))
  return Number(clamped.toFixed(4))
}

/** Build the per-attribute penalty map consumed by the selector. */
export function buildQualityPenaltyMap(
  bySignals: Record<string, QualitySignals>,
  opts: QualityPenaltyOptions = {},
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [attribute, signals] of Object.entries(bySignals)) {
    const penalty = computeQualityPenalty(signals, opts)
    // Only persist non-trivial penalties; skip 1.0 to keep the map small.
    if (penalty !== null && penalty < 1) {
      out[attribute] = penalty
    }
  }
  return out
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
