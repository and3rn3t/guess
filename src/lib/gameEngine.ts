import { SCORE_MATCH, SCORE_MAYBE, SCORE_MAYBE_MISS, SCORE_MISMATCH, SCORE_UNKNOWN, MAYBE_ANSWER_PROB, ALIVE_THRESHOLD } from './constants'
import type { Character, Question, Answer, ReasoningExplanation } from './types'

// ── Scoring options ──────────────────────────────────────────

export interface ScoringOptions {
  /** Map of attribute key → coverage ratio (0-1). Scales null attribute scores. */
  coverageMap?: Map<string, number>
  /** Map of character id → normalized popularity (0-1). Weak prior for initial scoring. */
  popularityMap?: Map<string, number>
}

/** Options for question selection behavior. */
export interface QuestionSelectionOptions {
  /** Game progress (questionCount / maxQuestions) for dynamic top-K threshold. Default: 0 */
  progress?: number
  /** Categories of the last 2 asked questions, for diversity penalty. */
  recentCategories?: string[]
  /** Scoring options passed through to calculateProbabilities. */
  scoring?: ScoringOptions
}

/** Compute a Bayesian-style probability for each character given the answers so far.
 *  Supports coverage-weighted null scoring and popularity priors. */
export function calculateProbabilities(
  characters: Character[],
  answers: Answer[],
  options?: ScoringOptions
): Map<string, number> {
  const probabilities = new Map<string, number>()
  const { coverageMap, popularityMap } = options ?? {}

  for (const character of characters) {
    // Weak popularity prior: 1.0 (unknown) to 1.1 (most popular)
    let score = popularityMap
      ? 1.0 + 0.1 * (popularityMap.get(character.id) ?? 0)
      : 1.0

    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId]

      // Coverage-weighted unknown score: sparse attributes score lower (0.3–0.7)
      const effectiveUnknown = coverageMap
        ? 0.3 + 0.4 * (coverageMap.get(answer.questionId) ?? 0.5)
        : SCORE_UNKNOWN

      if (answer.value === 'yes') {
        score *= characterValue === true ? SCORE_MATCH
          : characterValue === false ? SCORE_MISMATCH
          : effectiveUnknown
      } else if (answer.value === 'no') {
        score *= characterValue === false ? SCORE_MATCH
          : characterValue === true ? SCORE_MISMATCH
          : effectiveUnknown
      } else if (answer.value === 'maybe') {
        score *= characterValue === true ? SCORE_MAYBE
          : characterValue === false ? SCORE_MAYBE_MISS
          : effectiveUnknown
      }
      // 'unknown' → no effect on score
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

function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, p) => {
    if (p <= 0) return sum
    return sum - p * Math.log2(p)
  }, 0)
}

/** Pick the question with the highest expected information gain from the remaining pool.
 *  Enhanced with: sigmoid coverage penalty, three-way entropy (yes/no/maybe),
 *  top-N differentiation, category diversity, and dynamic top-K variety. */
export function selectBestQuestion(
  characters: Character[],
  answers: Answer[],
  allQuestions: Question[],
  options?: QuestionSelectionOptions
): Question | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  const probs = calculateProbabilities(characters, answers, options?.scoring)

  // Identify top-N candidates for differentiation boosting
  const sortedProbs = Array.from(probs.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length))
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0)
  const topNChars = topN.map(([id]) => characters.find((c) => c.id === id)!).filter(Boolean)

  const currentProbs = characters.map((c) => probs.get(c.id) || 0)
  const currentEntropy = entropy(currentProbs)
  const scored: Array<{ question: Question; score: number }> = []

  for (const question of availableQuestions) {
    // Partition characters into yes/no/unknown buckets with their probabilities
    let pYes = 0
    let pNo = 0
    let pUnknown = 0
    const yesProbs: number[] = []
    const noProbs: number[] = []
    const unknownProbs: number[] = []

    for (const c of characters) {
      const prob = probs.get(c.id) || 0
      const attr = c.attributes[question.attribute]
      if (attr === true) {
        pYes += prob
        yesProbs.push(prob)
      } else if (attr === false) {
        pNo += prob
        noProbs.push(prob)
      } else {
        pUnknown += prob
        unknownProbs.push(prob)
      }
    }

    // Three-way expected entropy: yes/no/maybe partitions
    let expectedEntropy = 0

    const yesTotal = pYes + pUnknown * 0.5
    const noTotal = pNo + pUnknown * 0.5

    // Adjusted weights to account for maybe answers (~15% probability)
    const adjustedYes = yesTotal * (1 - MAYBE_ANSWER_PROB)
    const adjustedNo = noTotal * (1 - MAYBE_ANSWER_PROB)

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

    // Maybe partition: all characters contribute with soft weights
    let maybeSum = 0
    const maybeWeighted: number[] = []
    for (const c of characters) {
      const prob = probs.get(c.id) || 0
      const attr = c.attributes[question.attribute]
      const w = attr === true ? SCORE_MAYBE : attr === false ? SCORE_MAYBE_MISS : SCORE_UNKNOWN
      const wp = prob * w
      maybeWeighted.push(wp)
      maybeSum += wp
    }
    if (maybeSum > 0) {
      const maybeGroupProbs = maybeWeighted.map((p) => p / maybeSum)
      expectedEntropy += MAYBE_ANSWER_PROB * entropy(maybeGroupProbs)
    }

    let infoGain = currentEntropy - expectedEntropy

    // Smooth sigmoid coverage penalty (replaces discontinuous step at 60%)
    // Gradual penalty starting ~35%, full suppression above ~70%
    const nullCount = characters.filter((c) => c.attributes[question.attribute] == null).length
    const nullRatio = nullCount / characters.length
    const coveragePenalty = 1 / (1 + Math.exp(10 * (nullRatio - 0.5)))
    infoGain *= coveragePenalty

    // Differentiation boost: when top-N candidates concentrate probability mass,
    // boost questions that distinguish between them
    if (topNMass > 0.6 && topNChars.length >= 2) {
      const topValues = topNChars.map((c) => c.attributes[question.attribute])
      const hasTrue = topValues.some((v) => v === true)
      const hasFalse = topValues.some((v) => v === false)
      if (hasTrue && hasFalse) {
        infoGain *= 1 + 0.5 * topNMass
      }
    }

    // Category diversity penalty: avoid consecutive questions in the same category
    if (options?.recentCategories?.length && question.category) {
      if (options.recentCategories.includes(question.category)) {
        infoGain *= 0.8
      }
    }

    scored.push({ question, score: infoGain })
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => b.score - a.score)
  if (scored[0].score <= 0) return scored[0].question

  // Dynamic top-K threshold: more variety early, more optimal late
  const progress = options?.progress ?? 0
  const thresholdFactor = 0.5 + 0.4 * progress // 0.5 early → 0.9 late
  const threshold = scored[0].score * thresholdFactor
  const topK = scored.filter((s) => s.score >= threshold)
  const totalWeight = topK.reduce((sum, s) => sum + s.score, 0)
  let random = Math.random() * totalWeight
  for (const candidate of topK) {
    random -= candidate.score
    if (random <= 0) return candidate.question
  }

  return topK[0].question
}

/** Build a human-readable explanation of why a question was chosen and its expected impact.
 *  Now includes top candidate names and probabilities for transparency. */
export function generateReasoning(
  question: Question,
  characters: Character[],
  answers: Answer[]
): ReasoningExplanation {
  const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length
  const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length
  const unknownCount = characters.length - yesCount - noCount

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])

  const topCharacter = sorted[0]
  const confidence = topCharacter ? topCharacter[1] * 100 : 0

  const topCandidates = sorted.slice(0, 5).map(([id, p]) => ({
    name: characters.find((c) => c.id === id)?.name ?? id,
    probability: Math.round(p * 100),
  }))

  const why = generateWhyExplanation(question, yesCount, noCount, unknownCount, characters.length)
  const impact = generateImpactExplanation(yesCount, noCount, characters.length)

  return {
    why,
    impact,
    remaining: characters.length,
    confidence: Math.round(confidence),
    topCandidates,
  }
}

function generateWhyExplanation(
  question: Question,
  yesCount: number,
  noCount: number,
  unknownCount: number,
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

function generateImpactExplanation(yesCount: number, noCount: number, total: number): string {
  const eliminateYes = noCount
  const eliminateNo = yesCount

  return `Answering "yes" would eliminate ${eliminateYes} possibilities (${Math.round((eliminateYes / total) * 100)}%), while "no" would eliminate ${eliminateNo} (${Math.round((eliminateNo / total) * 100)}%). Either way, we make significant progress.`
}

/** Decide whether confidence is high enough (or the question limit reached) to guess.
 *  Uses a continuous quadratic confidence curve, entropy-based triggers,
 *  and confidence escalation after wrong guesses. */
export function shouldMakeGuess(
  characters: Character[],
  answers: Answer[],
  questionCount: number,
  maxQuestions = 15,
  priorWrongGuesses = 0
): boolean {
  if (characters.length <= 1) return true

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a)
  const topProbability = sorted[0]

  // Hard limit: stop after maxQuestions
  if (questionCount >= maxQuestions) return true

  // Confidence escalation: +0.1 per wrong guess, capped at +0.3
  const escalation = Math.min(priorWrongGuesses * 0.1, 0.3)

  // Continuous progressive threshold: quadratic decay
  // progress=0: 0.8 | progress=0.5: 0.7 | progress=0.75: 0.575 | progress=1: 0.4
  const progress = questionCount / maxQuestions
  const requiredConfidence = Math.min(0.8 - 0.4 * progress * progress + escalation, 0.95)
  if (topProbability > requiredConfidence) return true

  // Count effectively alive candidates (above noise floor)
  const aliveCount = sorted.filter((p) => p > ALIVE_THRESHOLD).length

  // If only 2 candidates remain and we've asked at least 3 questions
  if (aliveCount <= 2 && questionCount >= 3 && topProbability >= Math.min(0.5 + escalation, 0.95))
    return true

  // Entropy-based trigger: if distribution is very narrow (~2 candidates), guess
  // After wrong guesses, require even narrower distribution
  const aliveProbs = sorted.filter((p) => p > ALIVE_THRESHOLD)
  const currentEntropy = entropy(aliveProbs)
  const entropyThreshold = 1.0 - escalation // 1.0 base → 0.7 after 3+ wrongs
  if (currentEntropy < entropyThreshold && questionCount >= 3) return true

  // Continuous gap-based guessing: required gap decreases with progress
  const secondProbability = sorted.length > 1 ? sorted[1] : 0
  const gap = topProbability - secondProbability
  const requiredGap = 0.4 - 0.2 * progress // 0.4 early → 0.2 late
  if (gap > requiredGap && topProbability > Math.min(0.4 + escalation, 0.95)) return true

  return false
}

/** Return the character with the highest probability given the current answers. */
export function getBestGuess(characters: Character[], answers: Answer[]): Character | null {
  if (characters.length === 0) return null

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const bestId = sorted[0][0]
  return characters.find((c) => c.id === bestId) || characters[0]
}

/** Check whether the current answers have eliminated all characters (contradiction). */
export function detectContradictions(
  allCharacters: Character[],
  answers: Answer[]
): { hasContradiction: boolean; remainingCount: number } {
  if (answers.length === 0) return { hasContradiction: false, remainingCount: allCharacters.length }

  const probabilities = calculateProbabilities(allCharacters, answers)
  const remaining = Array.from(probabilities.values()).filter((p) => p > 0).length

  return {
    hasContradiction: remaining === 0,
    remainingCount: remaining,
  }
}
