/**
 * Question-selection orchestrator (RF.v2.3).
 *
 * Pure math + classifiers live in `./question-selection/math.ts` and are
 * re-exported here to preserve the public API surface consumed via
 * `@guess/game-engine` (`entropy`, `getAttributeGroup`).
 *
 * This shell owns: candidate filtering, per-call state derivation
 * (`QuestionScoringContext`), iteration over `scoreQuestion`, top-K
 * weighted-random selection.
 */
import { MIN_INFO_GAIN } from './constants.js'
import { calculateProbabilities } from './scoring.js'
import type { GameAnswer, GameCharacter, GameQuestion, QuestionSelectionOptions } from './types.js'
import {
  applyNetGainFloor,
  buildNullRatioMap,
  entropy,
  getAttributeGroup,
  scoreQuestion,
  type QuestionScoringContext,
} from './question-selection/math.js'

// Re-export pure helpers so existing imports from `./question-selection` keep working.
export { entropy, getAttributeGroup, scoreQuestion }
export type { QuestionScoringContext }

/**
 * Pick the question with the highest expected information gain.
 *
 * Algorithm features (full scoring blend documented on `scoreQuestion`):
 * - Three-way expected entropy (yes/no/maybe answer partitions)
 * - Sigmoid coverage penalty for sparse attributes
 * - Top-N differentiation boost (pre-endgame)
 * - Pairwise top-candidate separation boost (endgame)
 * - Category and attribute-group diversity penalties
 * - Dynamic top-K weighted random selection for early-game variety
 */
export function selectBestQuestion(
  characters: GameCharacter[],
  answers: GameAnswer[],
  allQuestions: GameQuestion[],
  options?: QuestionSelectionOptions
): GameQuestion | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  // Use pre-computed probs if provided (avoids redundant calculateProbabilities call)
  const probs = options?.probs ?? calculateProbabilities(characters, answers, options?.scoring)

  const sortedProbs = Array.from(probs.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length))
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0)
  const topNChars = topN
    .map(([id]) => characters.find((c) => c.id === id))
    .filter((c): c is GameCharacter => c !== undefined)
  const topTwoChars = topNChars.slice(0, 2)

  const currentProbs = characters.map((c) => probs.get(c.id) ?? 0)
  const currentEntropy = entropy(currentProbs)
  const progress = options?.progress ?? 0
  const sw = options?.structuralWeights
  const endgameFocusThreshold = sw?.endgameFocusThreshold ?? 0.65
  const endgameFocus = progress >= endgameFocusThreshold || topNMass >= 0.75
  const diversityWindow = sw?.diversityWindow ?? 5
  const recentAttrGroups = new Set(
    answers.slice(-diversityWindow).map((a) => getAttributeGroup(a.questionId))
  )

  // Early-game taxonomy forcing: if no species/origin question has been asked yet and we
  // are still in the first 40% of the game, boost those attribute groups so the AI
  // establishes the fundamental character type (human / animal / robot / alien …) before
  // diving into specific ability or appearance questions.  Without this boost, very rare
  // types (e.g. robots, ~0.2% of the pool) produce near-zero info-gain and are never asked
  // directly — leaving null-attributed characters alive far too long.
  const earlyGame = progress < 0.4
  const needsSpecies =
    earlyGame && !answers.some((a) => getAttributeGroup(a.questionId) === 'species')
  const needsOrigin =
    earlyGame &&
    !answers.some((a) => {
      const g = getAttributeGroup(a.questionId)
      return g === 'medium' || g === 'geography' || g === 'genre'
    })

  // Net-gain pre-filter: skip provably low-info questions when higher-gain alternatives exist.
  const questionsToScore = applyNetGainFloor(
    availableQuestions,
    options?.netGainMap,
    sw?.netGainFloor
  )

  // Pre-compute null ratios for coverage penalty (avoids O(Q×C) re-scan inside the loop)
  const nullRatioMap = buildNullRatioMap(characters, questionsToScore)

  const ctx: QuestionScoringContext = {
    characters,
    answers,
    probs,
    currentEntropy,
    topNChars,
    topTwoChars,
    topNMass,
    endgameFocus,
    progress,
    needsSpecies,
    needsOrigin,
    recentAttrGroups,
    nullRatioMap,
    options,
    sw,
  }

  const scored: Array<{ question: GameQuestion; score: number; topTwoSplit: boolean }> = []
  for (const question of questionsToScore) {
    const { score, topTwoSplit } = scoreQuestion(question, ctx)
    scored.push({ question, score, topTwoSplit })
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => b.score - a.score)
  if (scored[0].score <= 0) return scored[0].question

  if (endgameFocus && progress >= 0.85) {
    const bestTopTwoSplit = scored.find((candidate) => candidate.topTwoSplit)
    // Threshold scales down as turns run out: 0.55 at progress=0.85 → 0.40 at progress=1.0
    const splitThreshold = Math.max(0.55 - (progress - 0.85), 0.4)
    // Also require a minimum absolute information gain floor so the top-two split
    // boost can't select a near-zero-IG question over a genuinely informative one.
    const igFloor = Math.max(currentEntropy * 0.05, 0.02)
    if (
      bestTopTwoSplit &&
      bestTopTwoSplit.score >= scored[0].score * splitThreshold &&
      bestTopTwoSplit.score >= igFloor
    ) {
      return bestTopTwoSplit.question
    }
    return scored[0].question
  }

  // Dynamic top-K threshold: more variety early, more optimal late.
  // When endgame focus is active, cap the pool to avoid wasting turns.
  const baseFactor = 0.3 + 0.6 * progress // 0.3 early → 0.9 late
  const thresholdFactor = endgameFocus ? Math.max(baseFactor, 0.8) : baseFactor
  const relativeThreshold = scored[0].score * thresholdFactor
  // Apply absolute floor so near-zero-gain questions (e.g. 100%-unknown attrs or
  // globally uninformative ones) are excluded from the selection pool when better
  // alternatives exist. Fall back to the full sorted list if all scores are sub-floor.
  const threshold = Math.max(relativeThreshold, MIN_INFO_GAIN)
  const topK = scored.filter((s) => s.score >= threshold)
  const pool = topK.length > 0 ? topK : scored.slice(0, 1)
  const totalWeight = pool.reduce((sum, s) => sum + s.score, 0)
  let random = Math.random() * totalWeight
  for (const candidate of pool) {
    random -= candidate.score
    if (random <= 0) return candidate.question
  }

  return pool[0].question
}
