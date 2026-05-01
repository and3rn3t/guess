/**
 * Cross-source agreement scoring (DQ.3).
 *
 * For a given (character, attribute) pair we collect AgreementSignal entries
 * from independent sources (player reveals, dispute outcomes, community votes)
 * and reduce them to a single weighted [0, 1] score.
 *
 * NULL score is preserved (returned as `null`) when no signals exist so the
 * admin UI can distinguish "uncontested because nobody has tested it" from
 * "uncontested and corroborated".
 */

export type AgreementSource =
  | 'reveal'
  | 'dispute-open'
  | 'dispute-dismissed'
  | 'dispute-resolved'
  | 'community-vote'

export interface AgreementSignal {
  source: AgreementSource
  /** True when this signal corroborates the stored attribute value. */
  agrees: boolean
}

const DEFAULT_WEIGHTS: Record<AgreementSource, number> = {
  // One reveal answer = one player vote. Cheap, plentiful, low individual weight.
  reveal: 1,
  // Open disputes were filed by the skeptic LLM and not yet resolved — strong
  // disagreement signal.
  'dispute-open': 2,
  // A dismissed dispute means a human reviewed it and kept the stored value.
  // Stronger corroboration than a single reveal.
  'dispute-dismissed': 2,
  // A resolved dispute means the value was changed; if it survived without
  // being re-disputed we treat it as a positive vote on the new value.
  'dispute-resolved': 1,
  // Community vote = aggregated user opinion (one row, may represent many users).
  'community-vote': 2,
}

export interface AgreementResult {
  score: number | null
  signalCount: number
}

export function computeAgreementScore(
  signals: readonly AgreementSignal[],
  weights: Partial<Record<AgreementSource, number>> = {}
): AgreementResult {
  if (signals.length === 0) {
    return { score: null, signalCount: 0 }
  }

  let agreeWeight = 0
  let totalWeight = 0
  for (const signal of signals) {
    const w = weights[signal.source] ?? DEFAULT_WEIGHTS[signal.source]
    if (w <= 0) continue
    totalWeight += w
    if (signal.agrees) agreeWeight += w
  }

  if (totalWeight === 0) {
    return { score: null, signalCount: signals.length }
  }

  return {
    score: Number((agreeWeight / totalWeight).toFixed(3)),
    signalCount: signals.length,
  }
}

/**
 * `agreement_score < 0.6` is the contested threshold per ROADMAP DQ.3 — used
 * by the admin UI to highlight rows and (eventually) by the engine to
 * down-weight the attribute when scoring candidates.
 */
export const CONTESTED_THRESHOLD = 0.6

export function isContested(result: AgreementResult): boolean {
  return result.score !== null && result.score < CONTESTED_THRESHOLD && result.signalCount >= 3
}
