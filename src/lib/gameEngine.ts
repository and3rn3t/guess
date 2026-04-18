import type { Character, Question, Answer, ReasoningExplanation } from './types'

// Scoring constants for Bayesian probability updates
const SCORE_MATCH = 1.0      // attribute matches answer
const SCORE_MISMATCH = 0.0   // attribute contradicts answer
const SCORE_UNKNOWN = 0.5    // attribute is null/undefined (partial credit)
const SCORE_MAYBE = 0.7      // "maybe" answer with matching attribute (soft positive)
const SCORE_MAYBE_MISS = 0.3 // "maybe" answer with contradicting attribute (soft negative)

/** Compute a Bayesian-style probability for each character given the answers so far.
 *  "maybe" answers now provide soft evidence rather than being ignored. */
export function calculateProbabilities(
  characters: Character[],
  answers: Answer[]
): Map<string, number> {
  const probabilities = new Map<string, number>()

  for (const character of characters) {
    let score = 1.0

    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId]

      if (answer.value === 'yes') {
        score *= characterValue === true ? SCORE_MATCH
          : characterValue === false ? SCORE_MISMATCH
          : SCORE_UNKNOWN
      } else if (answer.value === 'no') {
        score *= characterValue === false ? SCORE_MATCH
          : characterValue === true ? SCORE_MISMATCH
          : SCORE_UNKNOWN
      } else if (answer.value === 'maybe') {
        // "Maybe" provides soft evidence — lightly favors true, lightly penalizes false
        score *= characterValue === true ? SCORE_MAYBE
          : characterValue === false ? SCORE_MAYBE_MISS
          : SCORE_UNKNOWN
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
 *  Enhanced with: coverage penalty for sparse attributes, top-N candidate differentiation,
 *  and tiebreaker bonus for near-50/50 splits. */
export function selectBestQuestion(
  characters: Character[],
  answers: Answer[],
  allQuestions: Question[]
): Question | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  const probs = calculateProbabilities(characters, answers)

  // Identify top-N candidates for differentiation boosting
  const sortedProbs = Array.from(probs.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length))
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0)
  const topNChars = topN.map(([id]) => characters.find((c) => c.id === id)!).filter(Boolean)

  let bestQuestion: Question | null = null
  let bestScore = -1

  const currentProbs = characters.map((c) => probs.get(c.id) || 0)
  const currentEntropy = entropy(currentProbs)

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

    // Expected entropy after asking this question
    let expectedEntropy = 0

    const yesTotal = pYes + pUnknown * 0.5
    if (yesTotal > 0) {
      const yesGroupProbs = [
        ...yesProbs.map((p) => p / yesTotal),
        ...unknownProbs.map((p) => (p * 0.5) / yesTotal),
      ]
      expectedEntropy += yesTotal * entropy(yesGroupProbs)
    }

    const noTotal = pNo + pUnknown * 0.5
    if (noTotal > 0) {
      const noGroupProbs = [
        ...noProbs.map((p) => p / noTotal),
        ...unknownProbs.map((p) => (p * 0.5) / noTotal),
      ]
      expectedEntropy += noTotal * entropy(noGroupProbs)
    }

    let infoGain = currentEntropy - expectedEntropy

    // Coverage penalty: questions where >60% of characters have null/undefined
    // are unreliable — they produce "unknown" outcomes that don't eliminate much
    const nullCount = characters.filter((c) => c.attributes[question.attribute] == null).length
    const nullRatio = nullCount / characters.length
    if (nullRatio > 0.6) {
      infoGain *= 1 - (nullRatio - 0.6)  // Scale down: 60%→no penalty, 100%→60% of original
    }

    // Differentiation boost: when top-N candidates concentrate probability mass,
    // boost questions that distinguish between them
    if (topNMass > 0.6 && topNChars.length >= 2) {
      const topValues = topNChars.map((c) => c.attributes[question.attribute])
      const hasTrue = topValues.some((v) => v === true)
      const hasFalse = topValues.some((v) => v === false)
      if (hasTrue && hasFalse) {
        // This question splits the top candidates — scale boost by how much mass they hold
        infoGain *= 1 + 0.5 * topNMass
      }
    }

    if (infoGain > bestScore) {
      bestScore = infoGain
      bestQuestion = question
    }
  }

  return bestQuestion
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
 *  Uses progressive confidence thresholds that lower as more questions are asked,
 *  and detects when remaining non-zero candidates are few enough to guess. */
export function shouldMakeGuess(
  characters: Character[],
  answers: Answer[],
  questionCount: number,
  maxQuestions = 15
): boolean {
  if (characters.length <= 1) return true

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a)
  const topProbability = sorted[0]

  // Hard limit: stop after maxQuestions
  if (questionCount >= maxQuestions) return true

  // High confidence: guess when top candidate is >80%
  if (topProbability > 0.8) return true

  // Count characters with non-zero probability
  const aliveCount = sorted.filter((p) => p > 0).length

  // If only 2 candidates remain and we've asked at least 3 questions, pick the stronger one
  if (aliveCount <= 2 && questionCount >= 3 && topProbability >= 0.5) return true

  // Progressive threshold: lower the confidence bar as we approach maxQuestions
  // At halfway: need >65% | At 75% through: need >55% | Near end: need >45%
  const progress = questionCount / maxQuestions
  if (progress >= 0.75 && topProbability > 0.45) return true
  if (progress >= 0.5 && topProbability > 0.65) return true

  // Adaptive: if the gap between #1 and #2 is large enough and we've asked enough, go for it
  const halfwayPoint = Math.floor(maxQuestions / 2)
  const secondProbability = sorted.length > 1 ? sorted[1] : 0
  const gap = topProbability - secondProbability
  if (questionCount >= halfwayPoint && gap > 0.3 && topProbability > 0.5) return true

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
