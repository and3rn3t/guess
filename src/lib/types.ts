export interface Character {
  id: string
  name: string
  attributes: Record<string, boolean | null>
}

export interface Question {
  id: string
  text: string
  attribute: string
}

export type AnswerValue = 'yes' | 'no' | 'maybe' | 'unknown'

export interface Answer {
  questionId: string
  value: AnswerValue
}

export interface GameState {
  currentQuestion: Question | null
  answers: Answer[]
  possibleCharacters: Character[]
  confidence: number
  questionCount: number
  isComplete: boolean
  finalGuess: Character | null
}

export interface ReasoningExplanation {
  why: string
  impact: string
  remaining: number
  confidence: number
}
