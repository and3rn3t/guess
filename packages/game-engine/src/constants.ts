// ── Bayesian scoring weights ──────────────────────────────────────────────────
/** Perfect match: attribute value equals the expected answer. */
export const SCORE_MATCH = 1.0
/** Soft mismatch: non-zero so 1–2 noisy/erroneous attribute values don't eliminate a character. */
export const SCORE_MISMATCH = 0.05
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
