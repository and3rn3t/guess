import type { Character, Question, Answer, ReasoningExplanation } from './types'

/** Compute a Bayesian-style probability for each character given the answers so far. */
export function calculateProbabilities(
  characters: Character[],
  answers: Answer[]
): Map<string, number> {
  const probabilities = new Map<string, number>()

  characters.forEach((character) => {
    let score = 1.0

    answers.forEach((answer) => {
      const attribute = answer.questionId
      const characterValue = character.attributes[attribute]

      if (answer.value === 'yes') {
        if (characterValue === true) {
          score *= 1.0
        } else if (characterValue === false) {
          score *= 0.0
        } else {
          score *= 0.5
        }
      } else if (answer.value === 'no') {
        if (characterValue === false) {
          score *= 1.0
        } else if (characterValue === true) {
          score *= 0.0
        } else {
          score *= 0.5
        }
      } else {
        // maybe and unknown answers don't affect score
      }
    })

    probabilities.set(character.id, score)
  })

  const totalScore = Array.from(probabilities.values()).reduce((a, b) => a + b, 0)

  if (totalScore > 0) {
    probabilities.forEach((score, id) => {
      probabilities.set(id, score / totalScore)
    })
  }

  return probabilities
}

function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, p) => {
    if (p <= 0) return sum
    return sum - p * Math.log2(p)
  }, 0)
}

/** Pick the question with the highest expected information gain from the remaining pool. */
export function selectBestQuestion(
  characters: Character[],
  answers: Answer[],
  allQuestions: Question[]
): Question | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  const probs = calculateProbabilities(characters, answers)

  // Detect if top-2 candidates dominate — if so, boost differentiating questions
  const sortedProbs = Array.from(probs.entries()).sort((a, b) => b[1] - a[1])
  const top1 = sortedProbs[0]
  const top2 = sortedProbs.length > 1 ? sortedProbs[1] : null
  const top2Dominate = top2 !== null && top1[1] + top2[1] > 0.6

  let top1Char: Character | undefined
  let top2Char: Character | undefined
  if (top2Dominate) {
    top1Char = characters.find((c) => c.id === top1[0])
    top2Char = characters.find((c) => c.id === top2[0])
  }

  let bestQuestion: Question | null = null
  let bestScore = -1

  const currentProbs = characters.map((c) => probs.get(c.id) || 0)
  const currentEntropy = entropy(currentProbs)

  availableQuestions.forEach((question) => {
    // Partition characters into yes/no/unknown buckets with their probabilities
    let pYes = 0
    let pNo = 0
    let pUnknown = 0
    const yesProbs: number[] = []
    const noProbs: number[] = []
    const unknownProbs: number[] = []

    characters.forEach((c) => {
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
    })

    // Expected entropy after asking this question
    // "yes" answer: keeps yes chars + unknown chars (with penalty)
    // "no" answer: keeps no chars + unknown chars (with penalty)
    let expectedEntropy = 0

    // For "yes" answer: normalize probabilities within yes + unknown group
    const yesTotal = pYes + pUnknown * 0.5
    if (yesTotal > 0) {
      const yesGroupProbs = [
        ...yesProbs.map((p) => p / yesTotal),
        ...unknownProbs.map((p) => (p * 0.5) / yesTotal),
      ]
      expectedEntropy += yesTotal * entropy(yesGroupProbs)
    }

    // For "no" answer: normalize probabilities within no + unknown group
    const noTotal = pNo + pUnknown * 0.5
    if (noTotal > 0) {
      const noGroupProbs = [
        ...noProbs.map((p) => p / noTotal),
        ...unknownProbs.map((p) => (p * 0.5) / noTotal),
      ]
      expectedEntropy += noTotal * entropy(noGroupProbs)
    }

    let infoGain = currentEntropy - expectedEntropy

    // Boost questions that differentiate the top-2 candidates
    if (top2Dominate && top1Char && top2Char) {
      const attr1 = top1Char.attributes[question.attribute]
      const attr2 = top2Char.attributes[question.attribute]
      if (attr1 !== null && attr2 !== null && attr1 !== attr2) {
        infoGain *= 1.5
      }
    }

    if (infoGain > bestScore) {
      bestScore = infoGain
      bestQuestion = question
    }
  })

  return bestQuestion
}

/** Build a human-readable explanation of why a question was chosen and its expected impact. */
export function generateReasoning(
  question: Question,
  characters: Character[],
  answers: Answer[]
): ReasoningExplanation {
  const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length
  const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length
  const unknownCount = characters.length - yesCount - noCount

  const probabilities = calculateProbabilities(characters, answers)
  const topCharacter = Array.from(probabilities.entries()).sort((a, b) => b[1] - a[1])[0]
  const confidence = topCharacter ? topCharacter[1] * 100 : 0

  const why = generateWhyExplanation(question, yesCount, noCount, unknownCount, characters.length)
  const impact = generateImpactExplanation(yesCount, noCount, characters.length)

  return {
    why,
    impact,
    remaining: characters.length,
    confidence: Math.round(confidence),
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

/** Decide whether confidence is high enough (or the question limit reached) to guess. */
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
