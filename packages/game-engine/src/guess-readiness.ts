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
  answers: GameAnswer[],
  scoring?: ScoringOptions
): ReasoningExplanation {
  const total = characters.length
  const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length
  const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length
  const unknownCount = total - yesCount - noCount

  // Use scoring options for accurate probabilities (matches Bayesian ranking)
  const probabilities = calculateProbabilities(characters, answers, scoring)
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
  question: GameQuestion,
  yesCount: number,
  noCount: number,
  _unknownCount: number,
  total: number
): string {
  const yesPercent = Math.round((yesCount / total) * 100)
  const noPercent = Math.round((noCount / total) * 100)
  // Surface question text if available
  const questionText =
    'text' in question && typeof (question as { text?: unknown }).text === 'string'
      ? `"${(question as { text: string }).text}" `
      : ''

  if (Math.abs(yesCount - noCount) < total * 0.2) {
    return `${questionText}This splits the possibilities almost evenly: ${yesPercent}% could answer "yes" while ${noPercent}% would say "no". This is an optimal binary split that will eliminate roughly half the options regardless of your answer.`
  }

  if (yesCount < noCount) {
    return `${questionText}Only ${yesPercent}% of remaining possibilities have this trait. If you answer "yes", we can dramatically narrow down the options. If "no", we still eliminate a meaningful subset.`
  }

  return `${questionText}About ${yesPercent}% of remaining possibilities share this characteristic. This question targets a common trait that will help us understand the nature of what you're thinking.`
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
  // Use competitiveCount (chars with ≥15% of top probability) rather than aliveCount for
  // readiness gates. Hard floor 0.01 prevents inflation in uniform low-probability pools.
  const competitiveCount = aliveProbs.filter(
    (p) => p >= topProbability * 0.15 && p > 0.01
  ).length
  const questionsRemaining = Math.max(0, maxQuestions - questionCount)
  const progress = maxQuestions > 0 ? questionCount / maxQuestions : 1

  // Pool-size scale: large pools (e.g. 18k chars) structurally cap achievable confidence lower
  // than small pools (200 chars) because probability mass is spread across more candidates.
  // poolScale = 1.0 at ≤200 chars, ≈0.54 at 18k chars (log10 interpolation).
  const poolScale = Math.min(1.0, Math.log10(200) / Math.log10(Math.max(characters.length, 200)))

  // Wrong guesses raise the bar for future guesses (stricter, not more aggressive).
  const wrongGuessPenalty = Math.min(priorWrongGuesses * 0.04, 0.12)
  // requiredConfidence scales down with pool size and relaxes as progress increases
  const requiredConfidence = Math.min(
    (0.85 * poolScale) - 0.25 * progress * progress + wrongGuessPenalty,
    0.94 * poolScale
  )
  const requiredGap = Math.max(0.12 - 0.05 * progress + wrongGuessPenalty, 0.08)
  // requiredEntropy is exported for diagnostics but NOT used in decisions (see below).
  // In large sparse pools (418 alive chars) entropy is 6-8 bits and never reaches sub-1-bit
  // thresholds, making any entropy gate permanently blocking. We rely on competitiveCount instead.
  const requiredEntropy = Math.max(1.2 - 0.6 * progress - priorWrongGuesses * 0.05, 0.5)

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

  // ── Gate 1: minimum question floor ──────────────────────────────────────────
  // Always ask at least 5 questions; only near-certainty overrides.
  if (questionCount < 5 && topProbability < 0.95 * poolScale) {
    return { shouldGuess: false, trigger: 'insufficient_data', ...resultBase }
  }

  // ── Gate 2: time pressure (early endgame trigger) ──────────────────────────
  // Near the budget limit, voluntarily guess if a leader has emerged — avoids the hard
  // forced max_questions trigger and saves 3+ questions per game.
  // Only fires in large pools (≥100 chars): in small pools each remaining question is
  // valuable enough to use fully. competitiveCount ≤ 5 ensures at least some posterior
  // concentration (blocks when 100s of characters are equally likely).
  // topProbability ≥ 0.15 prevents spurious triggers when topP is very low (≤1%) — in
  // that regime the p > 0.01 floor in competitiveCount produces 0 competitive chars even
  // though the posterior is actually nearly uniform across many candidates.
  if (
    questionsRemaining <= 3 &&
    questionCount >= 5 &&
    characters.length >= 100 &&
    competitiveCount <= 5 &&
    topProbability >= 0.15
  ) {
    return { shouldGuess: true, trigger: 'time_pressure', ...resultBase }
  }

  // ── Gate 3: broad posterior hold ────────────────────────────────────────────
  // Keep asking while budget remains and posterior is still broad.
  // Pool-scaled threshold: with 18k chars, topP rarely exceeds 40% → use ~38% as the hold line.
  // Gap condition releases the hold early when a clear leader emerges (topP ≫ secondP).
  const holdThreshold = 0.70 * poolScale // ≈ 0.38 for 18k-char pool
  if (questionsRemaining > 3 && topProbability < holdThreshold && gap < 0.15) {
    return { shouldGuess: false, trigger: 'insufficient_data', ...resultBase }
  }

  // ── Gate 4: high_certainty ──────────────────────────────────────────────────
  // Strong single leader with a clear absolute gap. Threshold scales with pool size:
  // in an 18k pool, achieving 47% is as conclusive as 87% in a 200-char pool.
  const highCertaintyThreshold = Math.max(0.87 * poolScale, 0.35)
  const highCertainty =
    topProbability >= highCertaintyThreshold && gap >= 0.20 && competitiveCount <= 3
  if (highCertainty) {
    return { shouldGuess: true, trigger: 'high_certainty', ...resultBase }
  }

  // ── Gate 5: strict_readiness ─────────────────────────────────────────────────
  // Confidence + gap scaled to pool and progress. Entropy deliberately NOT used here:
  // in large sparse pools (418 alive chars) entropy is always 6-8 bits and would block
  // this trigger permanently. competitiveCount ≤ 8 is the concentration gate instead.
  const strictReady =
    topProbability >= requiredConfidence &&
    gap >= requiredGap &&
    competitiveCount <= 8

  return {
    shouldGuess: strictReady,
    trigger: strictReady ? 'strict_readiness' : 'insufficient_data',
    ...resultBase,
  }
}
