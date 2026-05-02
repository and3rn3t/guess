type GuessCharacter = {
  id: string
  name: string
  category: string
  imageUrl: string | null
  trivia?: string[]
}

type QuestionShape = {
  id: string
  text: string
  attribute: string
  displayText?: string
  category?: string
}

interface ReadinessShape {
  trigger?: string | null
  blockedByRejectCooldown?: boolean
  rejectCooldownRemaining?: number
  topProbability?: number
  gap?: number
  aliveCount?: number
  questionsRemaining?: number
  forced?: boolean
}

function toGuessCharacter(character: GuessCharacter): GuessCharacter {
  return {
    id: character.id,
    name: character.name,
    category: character.category,
    imageUrl: character.imageUrl,
    trivia: character.trivia,
  }
}

export function buildGuessResponse(input: {
  character: GuessCharacter
  confidence: number
  questionCount: number
  remaining: number
  guessCount: number
  readiness?: ReadinessShape
}) {
  return {
    type: 'guess' as const,
    character: toGuessCharacter(input.character),
    confidence: input.confidence,
    questionCount: input.questionCount,
    remaining: input.remaining,
    guessCount: input.guessCount,
    ...(input.readiness ? { readiness: input.readiness } : {}),
  }
}

export function buildQuestionResponse(input: {
  question: QuestionShape
  reasoning: unknown
  remaining: number
  questionCount: number
  eliminated?: number
  readiness?: ReadinessShape
  skippedCount?: number
  maxQuestions?: number
  guessCount?: number
  rejectCooldownRemaining?: number
}) {
  return {
    type: 'question' as const,
    question: input.question,
    reasoning: input.reasoning,
    remaining: input.remaining,
    questionCount: input.questionCount,
    ...(input.eliminated != null ? { eliminated: input.eliminated } : {}),
    ...(input.readiness ? { readiness: input.readiness } : {}),
    ...(input.skippedCount != null ? { skippedCount: input.skippedCount } : {}),
    ...(input.maxQuestions != null ? { maxQuestions: input.maxQuestions } : {}),
    ...(input.guessCount != null ? { guessCount: input.guessCount } : {}),
    ...(input.rejectCooldownRemaining != null
      ? { rejectCooldownRemaining: input.rejectCooldownRemaining }
      : {}),
  }
}

export function buildContradictionResponse(input: {
  question: QuestionShape
  reasoning: unknown
  remaining: number
  questionCount: number
}) {
  return {
    type: 'contradiction' as const,
    message: 'Your answers seem contradictory — no characters match. Last answer was undone.',
    question: input.question,
    reasoning: input.reasoning,
    remaining: input.remaining,
    questionCount: input.questionCount,
  }
}
