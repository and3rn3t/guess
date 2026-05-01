/**
 * AN.1 — pure aggregation for the per-question funnel.
 *
 * Given raw rows from `question_attempts` (one row per asked question) and
 * `client_events` (one row per `question_skip` event), build the per-question
 * funnel: shown / skipped / answer-mix / skipRate / maybeRate / frustrationScore.
 *
 * Frustration score is a 0–1 composite that surfaces "momentum-killer" questions:
 *
 *   frustrationScore = 0.6 × skipRate + 0.4 × maybeRate
 *
 * Skip rate dominates because an explicit skip is a stronger negative signal
 * than a "maybe" (the player may genuinely not know). Both rates are floor-clamped
 * to 0 and ceiling-clamped to 1. Pure so the route handler stays thin and the
 * scoring is unit-testable without a DB.
 */

export interface AttemptRow {
  question_id: string | null
  text: string | null
  shown: number
  yes: number
  no: number
  maybe: number
  unknown: number
}

export interface SkipRow {
  question_id: string | null
  skips: number
}

export interface PerQuestionRow {
  questionId: string
  text: string | null
  shown: number
  skipped: number
  yes: number
  no: number
  maybe: number
  unknown: number
  /** skipped / (shown + skipped) */
  skipRate: number
  /** maybe / shown (0 when shown = 0) */
  maybeRate: number
  /** 0.6 × skipRate + 0.4 × maybeRate */
  frustrationScore: number
}

/** Round to 4 decimals so the JSON response stays compact. */
function r4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** Clamp to [0, 1]. Defensive against future query changes. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * Combine attempt + skip rows keyed by `question_id`. Drops null IDs (legacy
 * attribute-only rows), since the leaderboard is meant to be actionable per
 * question. Sorted by `frustrationScore DESC` then `shown DESC` so high-noise
 * questions with low sample size don't bury well-attested ones.
 */
export function computePerQuestionFunnel(
  attempts: readonly AttemptRow[],
  skips: readonly SkipRow[],
  options: { minShown?: number } = {},
): PerQuestionRow[] {
  const minShown = options.minShown ?? 0
  const skipMap = new Map<string, number>()
  for (const s of skips) {
    if (!s.question_id) continue
    skipMap.set(s.question_id, (skipMap.get(s.question_id) ?? 0) + s.skips)
  }

  // Track which skip IDs we've consumed for future use; currently we drop
  // skip-only orphans entirely. Kept inline for clarity should we surface them.
  const rows: PerQuestionRow[] = []

  for (const a of attempts) {
    if (!a.question_id) continue
    if (a.shown < minShown) continue
    const skipped = skipMap.get(a.question_id) ?? 0
    const denom = a.shown + skipped
    const skipRate = denom > 0 ? clamp01(skipped / denom) : 0
    const maybeRate = a.shown > 0 ? clamp01(a.maybe / a.shown) : 0
    const frustrationScore = clamp01(0.6 * skipRate + 0.4 * maybeRate)
    rows.push({
      questionId: a.question_id,
      text: a.text,
      shown: a.shown,
      skipped,
      yes: a.yes,
      no: a.no,
      maybe: a.maybe,
      unknown: a.unknown,
      skipRate: r4(skipRate),
      maybeRate: r4(maybeRate),
      frustrationScore: r4(frustrationScore),
    })
  }

  rows.sort((a, b) => {
    if (b.frustrationScore !== a.frustrationScore) return b.frustrationScore - a.frustrationScore
    return b.shown - a.shown
  })

  return rows
}
