/**
 * AN.17 — pure scorer for the question retirement queue.
 *
 * Given raw rows from `question_attempts` (one row per asked question) and
 * `client_events` (one row per `question_skip` event), compute a composite
 * "retirement score" per question. Higher = stronger retirement candidate.
 *
 * Composite formula (each component clamped to [0, 1]):
 *
 *   skipRate    = skipped / (shown + skipped)            — high when players bail
 *   maybeRate   = maybe / shown                          — high when uncertain
 *   imbalance   = | 0.5 − yes / (yes + no) |  × 2        — high when answers are lopsided
 *                                                          (a 90/10 split is low info gain)
 *
 *   retirementScore = 0.4 × skipRate
 *                   + 0.3 × maybeRate
 *                   + 0.3 × imbalance
 *
 * Skip dominates because an explicit skip is the strongest negative signal.
 * Imbalance and maybeRate carry the rest (a 100% "yes" question and a 100%
 * "maybe" question are both useless for narrowing the candidate set).
 *
 * Pure so the route handler stays thin and the scoring is unit-testable
 * without a DB. Player-rating is reserved for a future signal — once
 * `question_score` writes land, blend it in here without changing the
 * route shape.
 */

export interface RetirementAttemptRow {
  question_id: string | null
  text: string | null
  attribute_key: string | null
  shown: number
  yes: number
  no: number
  maybe: number
  unknown: number
}

export interface RetirementSkipRow {
  question_id: string | null
  skips: number
}

export interface RetirementCandidate {
  questionId: string
  text: string | null
  attributeKey: string | null
  shown: number
  skipped: number
  yes: number
  no: number
  maybe: number
  unknown: number
  /** skipped / (shown + skipped) */
  skipRate: number
  /** maybe / shown */
  maybeRate: number
  /** | 0.5 − yes / (yes + no) | × 2 — 0 = perfect 50/50, 1 = all yes or all no */
  imbalance: number
  /** 0.4 × skipRate + 0.3 × maybeRate + 0.3 × imbalance */
  retirementScore: number
}

export interface ParsedRetirementParams {
  /** Only score questions with at least this many `shown` events. */
  minShown: number
  /** Maximum rows to return. */
  limit: number
  /** Window size in days for the underlying aggregation. */
  windowDays: number
}

const DEFAULT_MIN_SHOWN = 10
const DEFAULT_LIMIT = 50
const DEFAULT_WINDOW_DAYS = 30
const MIN_LIMIT = 5
const MAX_LIMIT = 500
const MIN_WINDOW_DAYS = 1
const MAX_WINDOW_DAYS = 365

/** Round to 4 decimals so the JSON response stays compact. */
function r4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function parsePositiveInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

export function parseRetirementParams(params: URLSearchParams): ParsedRetirementParams {
  return {
    minShown: parsePositiveInt(params.get('minShown'), DEFAULT_MIN_SHOWN, 1, 10_000),
    limit: parsePositiveInt(params.get('limit'), DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT),
    windowDays: parsePositiveInt(
      params.get('windowDays'),
      DEFAULT_WINDOW_DAYS,
      MIN_WINDOW_DAYS,
      MAX_WINDOW_DAYS,
    ),
  }
}

/**
 * Combine attempt + skip rows keyed by `question_id`. Drops rows whose
 * `question_id` is null (legacy attribute-only attempts) or whose `shown`
 * is below `minShown` so single-impression spikes don't dominate the queue.
 *
 * Sorted by `retirementScore DESC`, ties broken by `shown DESC` so well-
 * attested low-quality questions outrank one-off bad samples.
 */
export function computeRetirementQueue(
  attempts: readonly RetirementAttemptRow[],
  skips: readonly RetirementSkipRow[],
  options: { minShown?: number; limit?: number } = {},
): RetirementCandidate[] {
  const minShown = options.minShown ?? 0
  const limit = options.limit ?? Number.POSITIVE_INFINITY

  const skipMap = new Map<string, number>()
  for (const s of skips) {
    if (!s.question_id) continue
    skipMap.set(s.question_id, (skipMap.get(s.question_id) ?? 0) + s.skips)
  }

  const rows: RetirementCandidate[] = []
  for (const a of attempts) {
    if (!a.question_id) continue
    if (a.shown < minShown) continue

    const skipped = skipMap.get(a.question_id) ?? 0
    const denom = a.shown + skipped
    const skipRate = denom > 0 ? clamp01(skipped / denom) : 0
    const maybeRate = a.shown > 0 ? clamp01(a.maybe / a.shown) : 0
    const decisive = a.yes + a.no
    const imbalance =
      decisive > 0 ? clamp01(Math.abs(0.5 - a.yes / decisive) * 2) : 0

    const retirementScore = clamp01(
      0.4 * skipRate + 0.3 * maybeRate + 0.3 * imbalance,
    )

    rows.push({
      questionId: a.question_id,
      text: a.text,
      attributeKey: a.attribute_key,
      shown: a.shown,
      skipped,
      yes: a.yes,
      no: a.no,
      maybe: a.maybe,
      unknown: a.unknown,
      skipRate: r4(skipRate),
      maybeRate: r4(maybeRate),
      imbalance: r4(imbalance),
      retirementScore: r4(retirementScore),
    })
  }

  rows.sort((a, b) => {
    if (b.retirementScore !== a.retirementScore) return b.retirementScore - a.retirementScore
    return b.shown - a.shown
  })

  return rows.slice(0, limit)
}
