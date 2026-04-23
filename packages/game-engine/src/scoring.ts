import {
  SCORE_MATCH,
  SCORE_MISMATCH,
  SCORE_UNKNOWN,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
} from './constants.js'
import type { AnswerValue, GameAnswer, GameCharacter, ScoringOptions } from './types.js'

/**
 * Score a single answer against a character's attribute value.
 * Returns a likelihood multiplier in [0.05, 1].
 */
export function scoreForAnswer(
  answerValue: AnswerValue,
  characterValue: boolean | null | undefined,
  effectiveUnknown: number = SCORE_UNKNOWN
): number {
  if (answerValue === 'yes') {
    if (characterValue === true) return SCORE_MATCH
    if (characterValue === false) return SCORE_MISMATCH
    return effectiveUnknown
  }
  if (answerValue === 'no') {
    if (characterValue === false) return SCORE_MATCH
    if (characterValue === true) return SCORE_MISMATCH
    return effectiveUnknown
  }
  if (answerValue === 'maybe') {
    if (characterValue === true) return SCORE_MAYBE
    if (characterValue === false) return SCORE_MAYBE_MISS
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
      // attributes are capped at 0.55 (down from 0.70) so characters with null on
      // high-coverage species/origin attributes don't linger until late game.
      const effectiveUnknown = coverageMap
        ? 0.3 + 0.25 * (coverageMap.get(answer.questionId) ?? 0.5)
        : SCORE_UNKNOWN
      score *= scoreForAnswer(answer.value, characterValue, effectiveUnknown)
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
