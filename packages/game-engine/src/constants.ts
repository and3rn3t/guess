// ── Bayesian scoring weights ──────────────────────────────────────────────────
/** Perfect match: attribute value equals the expected answer. */
export const SCORE_MATCH = 1.0
/** Soft mismatch: non-zero so 1–2 noisy/erroneous attribute values don't eliminate a character.
 * Reduced from 0.05 → 0.03 to shrink residual probability of contradicted characters in
 * large pools, reducing aliveCount inflation and wrong-character survival. */
export const SCORE_MISMATCH = 0.03
/** Unknown (null) attribute: penalised below 0.5 to discourage sparse characters. */
export const SCORE_UNKNOWN = 0.35
/** "Maybe" answer — character has the attribute: soft positive. */
export const SCORE_MAYBE = 0.7
/** "Maybe" answer — character lacks the attribute: soft negative. */
export const SCORE_MAYBE_MISS = 0.3
/** Prior probability that the user answers "maybe" on any given question. */
export const MAYBE_ANSWER_PROB = 0.15

// ── Guess-readiness thresholds ────────────────────────────────────────────────
/** Characters with probability below this value are considered eliminated. */
export const ALIVE_THRESHOLD = 0.001

// ── Question selection ────────────────────────────────────────────────────────
/**
 * Minimum absolute information gain (bits) for a question to enter the
 * weighted-random selection pool. Questions scoring below this floor are
 * still available as a last-resort fallback but are excluded from the pool
 * when better alternatives exist. Prevents wasting turns on near-zero-gain
 * attributes (e.g. 100% unknown attrs, or globally unimportant questions).
 */
export const MIN_INFO_GAIN = 0.01

/**
 * Net-gain floor (0–1, normalized) below which questions are excluded from the
 * scoring pool when higher-gain alternatives exist. Net gain is computed as
 * `avgInfoGain × (1 − unknownRate)` from simulation data — it penalises attributes
 * that consistently elicit 'unknown' answers, which add no information.
 * Injectable per-game via `QuestionSelectionOptions.structuralWeights.netGainFloor`.
 */
export const NET_GAIN_FLOOR = 0.05
