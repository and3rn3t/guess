/**
 * 2-step look-ahead question selection (MCTS-inspired).
 *
 * For each candidate question (top-K by single-step info-gain), simulates all
 * 3 possible answer branches (yes / no / maybe), then for each branch greedily
 * picks the best follow-up question and measures the resulting expected entropy
 * after 2 turns.  Picks the question that minimises expected 2-step entropy.
 *
 * Compared to selectBestQuestion (1-step greedy), this catches pairs of
 * questions that together achieve higher disambiguation — e.g. a broad genus
 * question that opens up a precise follow-up — even if neither is individually
 * optimal by single-step metrics.
 *
 * Complexity: O(K1 × 3 × K2 × C) where K1 ≤ 20, K2 ≤ 8, so linear in C and
 * negligible relative to the existing O(Q × C) single-step pass.
 */

import {
  MAYBE_ANSWER_PROB,
  MIN_INFO_GAIN,
  SCORE_MATCH,
  SCORE_MISMATCH,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
  SCORE_UNKNOWN,
} from './constants.js'
import { calculateProbabilities } from './scoring.js'
import { entropy, selectBestQuestion } from './question-selection.js'
import type { GameAnswer, GameCharacter, GameQuestion, QuestionSelectionOptions } from './types.js'

// ── MCTS parameters ───────────────────────────────────────────────────────────

/** Max q1 candidates to evaluate at the first ply. */
const DEFAULT_CANDIDATE_COUNT = 20
/** Max q2 candidates to evaluate per branch at the second ply. */
const DEFAULT_FOLLOWUP_COUNT = 8
/**
 * Character pool size below which single-step greedy is already near-optimal
 * and the 2-step overhead is not worth it.
 */
const MCTS_MIN_POOL_SIZE = 15
/** Progress threshold above which we delegate to the greedy endgame logic. */
const MCTS_ENDGAME_THRESHOLD = 0.85

// ── Public types ──────────────────────────────────────────────────────────────

export interface MCTSOptions extends QuestionSelectionOptions {
  /** Max q1 candidates to explore. Default: 20. */
  candidates?: number
  /** Max q2 candidates per branch. Default: 8. */
  followupCandidates?: number
  /**
   * Progress threshold above which MCTS defers to the 1-step greedy endgame logic.
   * Default: 0.85. Set lower (e.g. 0.70) on hard mode so the greedy top-two-split
   * logic activates earlier when the question budget is tight (10 questions max).
   */
  mctsEndgameThreshold?: number
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Apply a single answer to the current probability distribution and renormalize.
 * Returns a new probability map (does not mutate the input).
 */
function applyAnswer(
  characters: GameCharacter[],
  probs: Map<string, number>,
  attribute: string,
  answer: 'yes' | 'no' | 'maybe'
): Map<string, number> {
  const updated = new Map<string, number>()
  let total = 0

  for (const char of characters) {
    const prior = probs.get(char.id) ?? 0
    const attrValue = char.attributes[attribute]
    let likelihood: number

    if (answer === 'yes') {
      if (attrValue === true) likelihood = SCORE_MATCH
      else if (attrValue === false) likelihood = SCORE_MISMATCH
      else likelihood = SCORE_UNKNOWN
    } else if (answer === 'no') {
      if (attrValue === false) likelihood = SCORE_MATCH
      else if (attrValue === true) likelihood = SCORE_MISMATCH
      else likelihood = SCORE_UNKNOWN
    } else {
      // maybe
      if (attrValue === true) likelihood = SCORE_MAYBE
      else if (attrValue === false) likelihood = SCORE_MAYBE_MISS
      else likelihood = SCORE_UNKNOWN
    }

    const posterior = prior * likelihood
    updated.set(char.id, posterior)
    total += posterior
  }

  // Renormalize to preserve probability axioms
  if (total > 0) {
    for (const [id, p] of updated) {
      updated.set(id, p / total)
    }
  }

  return updated
}

/**
 * Compute the expected Shannon entropy after asking a question (1-step look-ahead).
 * Mirrors the three-way branch decomposition in question-selection.ts but without
 * diversity penalties — used purely as an information-theoretic estimator.
 */
function expectedEntropyAfterQuestion(
  characters: GameCharacter[],
  probs: Map<string, number>,
  attribute: string,
  maybeRateMap?: Record<string, number>
): number {
  const maybeProb = maybeRateMap?.[attribute] ?? MAYBE_ANSWER_PROB
  let pYes = 0
  let pNo = 0
  const yesProbs: number[] = []
  const noProbs: number[] = []
  const unknownProbs: number[] = []
  let maybeSum = 0
  const maybeWeighted: number[] = []

  for (const c of characters) {
    const prob = probs.get(c.id) ?? 0
    const attr = c.attributes[attribute]
    if (attr === true) {
      pYes += prob
      yesProbs.push(prob)
      maybeWeighted.push(prob * SCORE_MAYBE)
      maybeSum += prob * SCORE_MAYBE
    } else if (attr === false) {
      pNo += prob
      noProbs.push(prob)
      maybeWeighted.push(prob * SCORE_MAYBE_MISS)
      maybeSum += prob * SCORE_MAYBE_MISS
    } else {
      unknownProbs.push(prob)
      maybeWeighted.push(prob * SCORE_UNKNOWN)
      maybeSum += prob * SCORE_UNKNOWN
    }
  }

  const pUnknown = unknownProbs.reduce((s, p) => s + p, 0)
  const yesTotal = pYes + pUnknown * 0.5
  const noTotal = pNo + pUnknown * 0.5
  const adjustedYes = yesTotal * (1 - maybeProb)
  const adjustedNo = noTotal * (1 - maybeProb)
  let expectedEntropy = 0

  if (adjustedYes > 0) {
    const yesGroupProbs = [
      ...yesProbs.map((p) => p / yesTotal),
      ...unknownProbs.map((p) => (p * 0.5) / yesTotal),
    ]
    expectedEntropy += adjustedYes * entropy(yesGroupProbs)
  }

  if (adjustedNo > 0) {
    const noGroupProbs = [
      ...noProbs.map((p) => p / noTotal),
      ...unknownProbs.map((p) => (p * 0.5) / noTotal),
    ]
    expectedEntropy += adjustedNo * entropy(noGroupProbs)
  }

  if (maybeSum > 0) {
    const maybeGroupProbs = maybeWeighted.map((p) => p / maybeSum)
    expectedEntropy += maybeProb * entropy(maybeGroupProbs)
  }

  return expectedEntropy
}

/**
 * Compute branch probabilities for a given attribute:
 * how likely is each answer (yes / no / maybe) given the current distribution?
 */
function branchProbabilities(
  characters: GameCharacter[],
  probs: Map<string, number>,
  attribute: string
): { pYes: number; pNo: number; pMaybe: number } {
  let pYes = 0
  let pNo = 0

  for (const c of characters) {
    const prob = probs.get(c.id) ?? 0
    const attr = c.attributes[attribute]
    if (attr === true) pYes += prob
    else if (attr === false) pNo += prob
    else {
      // null: split evenly between yes and no branches
      pYes += prob * 0.5
      pNo += prob * 0.5
    }
  }

  // Scale down yes/no by (1 - MAYBE_ANSWER_PROB); maybe is flat
  return {
    pYes: pYes * (1 - MAYBE_ANSWER_PROB),
    pNo: pNo * (1 - MAYBE_ANSWER_PROB),
    pMaybe: MAYBE_ANSWER_PROB,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Select the best next question using 2-step look-ahead (MCTS-inspired).
 *
 * Falls back to the 1-step greedy `selectBestQuestion` when:
 * - The pool is already small (≤ MCTS_MIN_POOL_SIZE) — greedy is near-optimal.
 * - We are in the endgame (progress ≥ MCTS_ENDGAME_THRESHOLD) — greedy already
 *   applies specialised top-two-split logic.
 * - There are fewer than 3 available questions.
 */
export function selectBestQuestionMCTS(
  characters: GameCharacter[],
  answers: GameAnswer[],
  allQuestions: GameQuestion[],
  options?: MCTSOptions
): GameQuestion | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  const progress = options?.progress ?? 0

  // Delegate to well-tuned greedy when MCTS is unlikely to add value
  const mctsEndgameThreshold = options?.mctsEndgameThreshold ?? MCTS_ENDGAME_THRESHOLD
  if (
    characters.length <= MCTS_MIN_POOL_SIZE ||
    progress >= mctsEndgameThreshold ||
    availableQuestions.length <= 3
  ) {
    return selectBestQuestion(characters, answers, allQuestions, options)
  }

  const probs = options?.probs ?? calculateProbabilities(characters, answers, options?.scoring)
  const currentEntropy = entropy(Array.from(probs.values()))

  // Already converged — no questions will help further
  if (currentEntropy <= 0) return availableQuestions[0] ?? null

  const candidateCount = options?.candidates ?? DEFAULT_CANDIDATE_COUNT
  const followupCount = options?.followupCandidates ?? DEFAULT_FOLLOWUP_COUNT

  // ── Step 1: Score all available questions by 1-step info-gain ────────────────
  // This is O(Q × C) — identical to what selectBestQuestion does internally.
  const singleStep: Array<{ question: GameQuestion; gain: number }> = []

  for (const q of availableQuestions) {
    const expEntropy = expectedEntropyAfterQuestion(characters, probs, q.attribute, options?.maybeRateMap)
    singleStep.push({ question: q, gain: currentEntropy - expEntropy })
  }

  singleStep.sort((a, b) => b.gain - a.gain)

  // Top-K candidates for q1 (2-step exploration)
  const q1Candidates = singleStep.slice(0, candidateCount)
  // Top-K candidates for q2 (greedy best follow-up per branch)
  const q2Pool = singleStep.slice(0, followupCount)

  // ── Step 2: 2-step look-ahead per q1 candidate ──────────────────────────────
  const twoStep: Array<{ question: GameQuestion; score: number }> = []

  for (const { question: q1 } of q1Candidates) {
    const { pYes, pNo, pMaybe } = branchProbabilities(characters, probs, q1.attribute)
    let expectedTwoStepEntropy = 0

    for (const [answer, weight] of [
      ['yes', pYes],
      ['no', pNo],
      ['maybe', pMaybe],
    ] as const) {
      if (weight < 0.001) continue

      // Simulate updated distribution after answering q1 with `answer`
      const branchProbs = applyAnswer(characters, probs, q1.attribute, answer)
      const branchEntropy = entropy(Array.from(branchProbs.values()))

      if (branchEntropy <= 0) {
        // Branch is fully resolved — contributes 0 entropy
        expectedTwoStepEntropy += weight * 0
        continue
      }

      // Find the best follow-up question for this branch (greedy 1-step, no penalties)
      const askedAfterQ1 = new Set([...askedAttributes, q1.attribute])
      let bestFollowupEntropy = branchEntropy // default: no useful follow-up found

      for (const { question: q2 } of q2Pool) {
        if (askedAfterQ1.has(q2.attribute)) continue
        const followupEntropy = expectedEntropyAfterQuestion(characters, branchProbs, q2.attribute)
        if (followupEntropy < bestFollowupEntropy) {
          bestFollowupEntropy = followupEntropy
          if (bestFollowupEntropy <= 0) break // perfect discriminator — no need to search further
        }
      }

      expectedTwoStepEntropy += weight * bestFollowupEntropy
    }

    const twoStepGain = currentEntropy - expectedTwoStepEntropy
    twoStep.push({ question: q1, score: twoStepGain })
  }

  if (twoStep.length === 0) {
    return selectBestQuestion(characters, answers, allQuestions, options)
  }

  twoStep.sort((a, b) => b.score - a.score)

  // ── Step 3: Weighted random selection (same early-game variety as greedy) ────
  // Early game: wider pool (thresholdFactor ≈ 0.3); late game: narrower (≈ 0.9).
  const thresholdFactor = 0.3 + 0.6 * progress
  const threshold = Math.max(twoStep[0].score * thresholdFactor, MIN_INFO_GAIN)
  const pool = twoStep.filter((s) => s.score >= threshold)
  const finalPool = pool.length > 0 ? pool : twoStep.slice(0, 1)
  const totalWeight = finalPool.reduce((sum, s) => sum + s.score, 0)

  let random = Math.random() * totalWeight
  for (const { question, score } of finalPool) {
    random -= score
    if (random <= 0) return question
  }

  return finalPool[0].question
}
