/**
 * Player-answer corroboration (DQ.5)
 *
 * Pure logic: given the set of confident yes/no answers players gave about
 * a (character, attribute) pair (sourced from `game_reveals.answers`), and
 * the value currently stored in `character_attributes`, decide whether the
 * pair has accumulated enough player signal to file an `attribute_disputes`
 * row.
 *
 * "Enough signal" is two thresholds, both required:
 *   1. minVotes (default 20)        — we need real volume before trusting it
 *   2. disagreementThreshold (0.7)  — fraction of votes that disagreed with
 *                                     the stored value
 *
 * Players become a continuous QA workforce — for free.
 */

export type AttributeBoolean = 0 | 1

export interface PlayerVote {
  /** 1 = player answered "yes", 0 = "no". Maybe/unknown answers are filtered upstream. */
  value: AttributeBoolean
}

export interface CorroborationOptions {
  /** Minimum number of confident yes/no votes required before evaluation. Default: 20 */
  minVotes?: number
  /** Fraction of votes that must disagree with stored value to dispute. Default: 0.7 */
  disagreementThreshold?: number
}

export interface CorroborationResult {
  totalVotes: number
  yesVotes: number
  noVotes: number
  storedValue: AttributeBoolean
  /** Fraction of votes (0..1) that contradicted the stored value. */
  disagreementRate: number
  /** True iff totalVotes ≥ minVotes AND disagreementRate > disagreementThreshold. */
  shouldDispute: boolean
  /**
   * Majority player vote when shouldDispute is true; null on a perfect tie.
   * Always null when shouldDispute is false.
   */
  suggestedValue: AttributeBoolean | null
  /** Human-readable single-line summary, suitable for `attribute_disputes.dispute_reason`. */
  reason: string
}

export const DEFAULT_MIN_VOTES = 20
export const DEFAULT_DISAGREEMENT_THRESHOLD = 0.7

/**
 * Evaluate one (character, attribute) pair.
 *
 * @param votes        Confident yes/no votes from `game_reveals.answers`
 * @param storedValue  The value currently in `character_attributes.value`
 * @param opts         Optional threshold overrides
 */
export function evaluateCorroboration(
  votes: ReadonlyArray<PlayerVote>,
  storedValue: AttributeBoolean,
  opts: CorroborationOptions = {}
): CorroborationResult {
  const minVotes = opts.minVotes ?? DEFAULT_MIN_VOTES
  const disagreementThreshold = opts.disagreementThreshold ?? DEFAULT_DISAGREEMENT_THRESHOLD

  let yesVotes = 0
  let noVotes = 0
  for (const v of votes) {
    if (v.value === 1) yesVotes++
    else if (v.value === 0) noVotes++
  }

  const totalVotes = yesVotes + noVotes
  const disagreeing = storedValue === 1 ? noVotes : yesVotes
  const disagreementRate = totalVotes === 0 ? 0 : disagreeing / totalVotes

  const meetsVolume = totalVotes >= minVotes
  const meetsDisagreement = disagreementRate > disagreementThreshold
  const shouldDispute = meetsVolume && meetsDisagreement

  let suggestedValue: AttributeBoolean | null = null
  if (shouldDispute) {
    if (yesVotes > noVotes) suggestedValue = 1
    else if (noVotes > yesVotes) suggestedValue = 0
    // else: tie — leave as null (declared default)
  }

  const pct = (disagreementRate * 100).toFixed(1)
  const reason = shouldDispute
    ? `Player corroboration: ${disagreeing}/${totalVotes} reveal answers (${pct}%) disagreed with stored value=${storedValue}; suggested=${suggestedValue ?? 'tie'}`
    : `Player corroboration: ${disagreeing}/${totalVotes} disagreement (need ≥${minVotes} votes and >${(disagreementThreshold * 100).toFixed(0)}%)`

  return {
    totalVotes,
    yesVotes,
    noVotes,
    storedValue,
    disagreementRate: Number(disagreementRate.toFixed(4)),
    shouldDispute,
    suggestedValue,
    reason,
  }
}

/**
 * Map a disagreement rate (0..1) to an `attribute_disputes.confidence` value.
 * Linear in [threshold, 1] → [0.7, 0.99] so the dispute queue can be sorted
 * by player conviction.
 */
export function disagreementToConfidence(
  disagreementRate: number,
  disagreementThreshold: number = DEFAULT_DISAGREEMENT_THRESHOLD
): number {
  if (disagreementRate <= disagreementThreshold) return 0.7
  const range = 1 - disagreementThreshold
  if (range <= 0) return 0.99
  const scaled = (disagreementRate - disagreementThreshold) / range
  const clamped = Math.max(0, Math.min(1, scaled))
  return Number((0.7 + 0.29 * clamped).toFixed(3))
}
