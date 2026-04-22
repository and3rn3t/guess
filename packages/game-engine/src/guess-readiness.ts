import { ALIVE_THRESHOLD } from './constants.js'
import { calculateProbabilities } from './scoring.js'
import { entropy } from './question-selection.js'
import type {
  GameAnswer,
  GameCharacter,
  GameQuestion,
  GuessReadiness,
  ReasoningExplanation,
  ScoringOptions,
} from './types.js'

/**
 * Build a human-readable explanation of why a question was chosen and its
 * expected impact. Includes top candidate names, probabilities, and images.
 */
export function generateReasoning(
  question: GameQuestion,
  characters: GameCharacter[],
  answers: GameAnswer[]
): ReasoningExplanation {
  const total = characters.length
  const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length
  const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length
  const unknownCount = total - yesCount - noCount

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])

  const topCharacter = sorted[0]
  const confidence = topCharacter ? topCharacter[1] * 100 : 0

  const topCandidates = sorted.slice(0, 5).map(([id, p]) => {
    const char = characters.find((c) => c.id === id)
    return {
      name: char?.name ?? id,
      probability: Math.round(p * 100),
      imageUrl: char?.imageUrl ?? null,
    }
  })

  const why = buildWhyExplanation(question, yesCount, noCount, unknownCount, total)
  const impact = buildImpactExplanation(yesCount, noCount, total)

  return {
    why,
    impact,
    remaining: total,
    confidence: Math.round(confidence),
    topCandidates,
  }
}

function buildWhyExplanation(
  _question: GameQuestion,
  yesCount: number,
  noCount: number,
  _unknownCount: number,
  total: number
): string {
  const yesPercent = Math.round((yesCount / total) * 100)
  const noPercent = Math.round((noCount / total) * 100)

  if (Math.abs(yesCount - noCount) < total * 0.2) {
    return `This question splits the possibilities almost perfectly: ${yesPercent}% could answer "yes" while ${noPercent}% would say "no". This is an optimal binary split that will eliminate roughly half the options regardless of your answer.`
  }

  if (yesCount < noCount) {
    return `Only ${yesPercent}% of remaining possibilities have this trait. If you answer "yes", we can dramatically narrow down the options. If "no", we still eliminate a meaningful subset.`
  }

  return `About ${yesPercent}% of remaining possibilities share this characteristic. This question targets a common trait that will help us understand the nature of what you're thinking.`
}

function buildImpactExplanation(yesCount: number, noCount: number, total: number): string {
  const eliminateYes = noCount
  const eliminateNo = yesCount

  return `Answering "yes" would eliminate ${eliminateYes} possibilities (${Math.round((eliminateYes / total) * 100)}%), while "no" would eliminate ${eliminateNo} (${Math.round((eliminateNo / total) * 100)}%). Either way, we make significant progress.`
}

/** Return the character with the highest posterior probability. */
export function getBestGuess(
  characters: GameCharacter[],
  answers: GameAnswer[]
): GameCharacter | null {
  if (characters.length === 0) return null

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const bestId = sorted[0][0]
  return characters.find((c) => c.id === bestId) ?? characters[0]
}

/**
 * Check whether the current answers have eliminated all characters
 * (a contradiction in the posterior).
 */
export function detectContradictions(
  allCharacters: GameCharacter[],
  answers: GameAnswer[]
): { hasContradiction: boolean; remainingCount: number } {
  if (answers.length === 0) {
    return { hasContradiction: false, remainingCount: allCharacters.length }
  }
  // Mirror filterPossibleCharacters MAX_MISMATCHES=2 logic for consistency.
  // Allows up to 2 contradictions to tolerate enrichment errors + one user mistake.
  const MAX_MISMATCHES = 2
  const remaining = allCharacters.filter((char) => {
    let mismatches = 0
    for (const answer of answers) {
      const attr = char.attributes[answer.questionId]
      if (answer.value === 'yes' && attr === false) mismatches++
      else if (answer.value === 'no' && attr === true) mismatches++
      if (mismatches > MAX_MISMATCHES) return false
    }
    return true
  }).length
  return { hasContradiction: remaining === 0, remainingCount: remaining }
}

/**
 * Decide whether confidence is high enough (or the question limit reached) to guess.
 * Thin wrapper around evaluateGuessReadiness.
 */
export function shouldMakeGuess(
  characters: GameCharacter[],
  answers: GameAnswer[],
  questionCount: number,
  maxQuestions = 15,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions
): boolean {
  return evaluateGuessReadiness(
    characters,
    answers,
    questionCount,
    maxQuestions,
    priorWrongGuesses,
    scoring
  ).shouldGuess
}

/**
 * Determine whether the posterior is concentrated enough to make a guess.
 *
 * Returns a `GuessReadiness` object with the decision, trigger reason, and all
 * diagnostic metrics (for transparency and the readiness analytics dashboard).
 *
 * @param preComputedProbs - Optional pre-computed probabilities. When provided,
 *   avoids a redundant `calculateProbabilities` call inside this function.
 */
export function evaluateGuessReadiness(
  characters: GameCharacter[],
  answers: GameAnswer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions,
  preComputedProbs?: Map<string, number>
): GuessReadiness {
  // 0 characters = full contradiction; force a guess to surface it
  if (characters.length === 0) {
    return {
      shouldGuess: true,
      forced: true,
      trigger: 'singleton',
      topProbability: 0,
      secondProbability: 0,
      gap: 0,
      entropy: 0,
      aliveCount: 0,
      questionsRemaining: Math.max(0, maxQuestions - questionCount),
      requiredConfidence: 0,
      requiredGap: 0,
      requiredEntropy: 0,
    }
  }

  // Singleton: only one character survives, but require ≥ 5 questions to avoid
  // premature guesses from early spurious eliminations.
  if (characters.length <= 1 && questionCount >= 5) {
    return {
      shouldGuess: true,
      forced: false,
      trigger: 'singleton',
      topProbability: 1,
      secondProbability: 0,
      gap: 1,
      entropy: 0,
      aliveCount: characters.length,
      questionsRemaining: Math.max(0, maxQuestions - questionCount),
      requiredConfidence: 0,
      requiredGap: 0,
      requiredEntropy: 0,
    }
  }

  if (questionCount >= maxQuestions) {
    return {
      shouldGuess: true,
      forced: true,
      trigger: 'max_questions',
      topProbability: 0,
      secondProbability: 0,
      gap: 0,
      entropy: 0,
      aliveCount: characters.length,
      questionsRemaining: 0,
      requiredConfidence: 0,
      requiredGap: 0,
      requiredEntropy: 0,
    }
  }

  const probabilities =
    preComputedProbs ?? calculateProbabilities(characters, answers, scoring)
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a)
  const topProbability = sorted[0] ?? 0
  const secondProbability = sorted[1] ?? 0
  const gap = topProbability - secondProbability

  const aliveProbs = sorted.filter((p) => p > ALIVE_THRESHOLD)
  const aliveCount = aliveProbs.length
  const currentEntropy = entropy(aliveProbs)
  // With SCORE_MISMATCH=0.05, tolerated 1-mismatch chars have residual probability that inflates
  // aliveCount. Use competitiveCount (chars with ≥15% of top probability) for readiness gates.
  // Hard floor of 0.01 prevents inflated competitiveCount in uniform low-probability pools
  const competitiveCount = aliveProbs.filter(
    (p) => p >= topProbability * 0.15 && p > 0.01
  ).length
  const questionsRemaining = Math.max(0, maxQuestions - questionCount)
  const progress = maxQuestions > 0 ? questionCount / maxQuestions : 1

  // Wrong guesses make future guesses stricter, not more aggressive.
  const wrongGuessPenalty = Math.min(priorWrongGuesses * 0.04, 0.12)
  const requiredConfidence = Math.min(0.85 - 0.25 * progress * progress + wrongGuessPenalty, 0.94)
  const requiredGap = Math.max(0.12 - 0.05 * progress + wrongGuessPenalty, 0.08)
  const requiredEntropy = Math.max(0.55 - 0.2 * progress - priorWrongGuesses * 0.04, 0.3)

  const resultBase = {
    forced: false,
    topProbability,
    secondProbability,
    gap,
    entropy: currentEntropy,
    aliveCount,
    questionsRemaining,
    requiredConfidence,
    requiredGap,
    requiredEntropy,
  }

  // Ask a minimum of questions before non-forced guesses;
  // only overwhelming certainty overrides.
  if (questionCount < 5 && topProbability < 0.95) {
    return { shouldGuess: false, trigger: 'insufficient_data', ...resultBase }
  }

  // Keep asking while budget remains and posterior is still broad.
  // Use competitiveCount (≥15% of top) rather than aliveCount to avoid inflation
  // from residual SCORE_MISMATCH probabilities on eliminated-but-not-zeroed characters.
  if (questionsRemaining > 3 && topProbability < 0.82 && competitiveCount > 2) {
    return { shouldGuess: false, trigger: 'insufficient_data', ...resultBase }
  }

  const highCertainty = topProbability >= 0.93 && gap >= 0.25 && competitiveCount <= 2
  if (highCertainty) {
    return { shouldGuess: true, trigger: 'high_certainty', ...resultBase }
  }

  // questionCount >= 3 is always satisfied here (min-guard above blocks q < 5)
  const strictReady =
    topProbability >= requiredConfidence &&
    gap >= requiredGap &&
    competitiveCount <= 3 &&
    currentEntropy <= requiredEntropy

  return {
    shouldGuess: strictReady,
    trigger: strictReady ? 'strict_readiness' : 'insufficient_data',
    ...resultBase,
  }
}
