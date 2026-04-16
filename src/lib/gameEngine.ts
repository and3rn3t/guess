import type { Character, Question, Answer, AnswerValue, ReasoningExplanation } from './types'

export function calculateProbabilities(
  characters: Character[],
  answers: Answer[]
): Map<string, number> {
  const probabilities = new Map<string, number>()

  characters.forEach((character) => {
    let score = 1.0
    let totalWeight = 0

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
        totalWeight += 1
      } else if (answer.value === 'no') {
        if (characterValue === false) {
          score *= 1.0
        } else if (characterValue === true) {
          score *= 0.0
        } else {
          score *= 0.5
        }
        totalWeight += 1
      } else if (answer.value === 'maybe') {
        totalWeight += 0.3
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

export function selectBestQuestion(
  characters: Character[],
  answers: Answer[],
  allQuestions: Question[]
): Question | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  let bestQuestion: Question | null = null
  let bestScore = -1

  availableQuestions.forEach((question) => {
    const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length
    const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length
    const unknownCount = characters.length - yesCount - noCount

    const balance = Math.min(yesCount, noCount) + unknownCount * 0.3
    const coverage = (yesCount + noCount) / characters.length

    const score = balance * coverage

    if (score > bestScore) {
      bestScore = score
      bestQuestion = question
    }
  })

  return bestQuestion
}

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

export function shouldMakeGuess(
  characters: Character[],
  answers: Answer[],
  questionCount: number
): boolean {
  const probabilities = calculateProbabilities(characters, answers)
  const topProbability = Math.max(...Array.from(probabilities.values()))

  return topProbability > 0.8 || questionCount >= 20 || characters.length === 1
}

export function getBestGuess(characters: Character[], answers: Answer[]): Character | null {
  if (characters.length === 0) return null

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries()).sort((a, b) => b[1] - a[1])

  const bestId = sorted[0][0]
  return characters.find((c) => c.id === bestId) || characters[0]
}
