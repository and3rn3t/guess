import {
  SCORE_MATCH,
  SCORE_MISMATCH,
  SCORE_UNKNOWN,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
} from './constants.js'
import type { AnswerValue, GameAnswer, GameCharacter, ScoringOptions, ScoringWeights } from './types.js'

/**
 * Score a single answer against a character's attribute value.
 * Returns a likelihood multiplier in [0.05, 1].
 * Optional `weights` override the module-level constants (used by grid search).
 */
export function scoreForAnswer(
  answerValue: AnswerValue,
  characterValue: boolean | null | undefined,
  effectiveUnknown: number = SCORE_UNKNOWN,
  weights?: ScoringWeights,
): number {
  const match    = weights?.match    ?? SCORE_MATCH
  const mismatch = weights?.mismatch ?? SCORE_MISMATCH
  const maybe    = weights?.maybe    ?? SCORE_MAYBE
  const maybeMiss = weights?.maybeMiss ?? SCORE_MAYBE_MISS

  if (answerValue === 'yes') {
    if (characterValue === true) return match
    if (characterValue === false) return mismatch
    return effectiveUnknown
  }
  if (answerValue === 'no') {
    if (characterValue === false) return match
    if (characterValue === true) return mismatch
    return effectiveUnknown
  }
  if (answerValue === 'maybe') {
    if (characterValue === true) return maybe
    if (characterValue === false) return maybeMiss
    return effectiveUnknown
  }
  return 1 // 'unknown' → no effect
}

/**
 * Compute Bayesian-style posterior probability for each character given the
 * current answers. Supports coverage-weighted null scoring and popularity priors.
 */
export function calculateProbabilities(
  characters: GameCharacter[],
  answers: GameAnswer[],
  options?: ScoringOptions
): Map<string, number> {
  const probabilities = new Map<string, number>()
  const { coverageMap, popularityMap } = options ?? {}

  for (const character of characters) {
    // Popularity prior decays with game progress: full strength early → neutral at game end
    const priorStrength = options?.progress !== undefined ? 1 - options.progress : 1
    let score = popularityMap
      ? 1.0 + 0.1 * priorStrength * (popularityMap.get(character.id) ?? 0)
      : 1

    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId]
      // Coverage-weighted unknown score: sparse attributes score lower, well-covered
      // attributes are capped at 0.45 (reduced from 0.55) so characters with null on
      // high-coverage species/origin attributes are penalized more aggressively in large pools,
      // reducing the 400+ alive-count problem in 18k-character simulations.
      const effectiveUnknown = coverageMap
        ? 0.3 + 0.15 * (coverageMap.get(answer.questionId) ?? 0.5)
        : SCORE_UNKNOWN
      let multiplier = scoreForAnswer(answer.value, characterValue, effectiveUnknown, options?.weights)
      // Dispute-aware scoring: when a character-attribute pair is disputed (open in
      // attribute_disputes), blend the computed score toward the neutral effectiveUnknown
      // score proportional to (1 − confidence). This softens the signal from contested
      // attributes without eliminating it entirely, tolerating LLM false positives.
      if (characterValue !== null) {
        const disputeConfidence = options?.disputeMap?.[character.id]?.[answer.questionId]
        if (disputeConfidence !== undefined) {
          multiplier = disputeConfidence * multiplier + (1 - disputeConfidence) * effectiveUnknown
        }
      }
      score *= multiplier
      // Early exit: once negligibly probable, skip remaining answers
      if (score < 1e-8) {
        score = 0
        break
      }
    }

    probabilities.set(character.id, score)
  }

  const totalScore = Array.from(probabilities.values()).reduce((a, b) => a + b, 0)
  if (totalScore > 0) {
    for (const [id, score] of probabilities) {
      probabilities.set(id, score / totalScore)
    }
  }

  return probabilities
}
