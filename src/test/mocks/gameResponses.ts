export interface GameQuestion {
  id: string
  text: string
  attribute: string
}

export interface GameReasoning {
  why: string
  impact: string
  remaining: number
  confidence: number
  topCandidates: Array<unknown>
}

export interface StartResponseOverrides {
  sessionId?: string
  question?: GameQuestion
  reasoning?: GameReasoning
  totalCharacters?: number
}

export const DEFAULT_GAME_QUESTION: GameQuestion = {
  id: 'q1',
  text: 'Q1',
  attribute: 'isHuman',
}

export const DEFAULT_GAME_REASONING: GameReasoning = {
  why: '',
  impact: '',
  remaining: 10,
  confidence: 0,
  topCandidates: [],
}

export function buildStartResponse(overrides: StartResponseOverrides = {}) {
  return {
    sessionId: 'sess-abc',
    question: DEFAULT_GAME_QUESTION,
    reasoning: DEFAULT_GAME_REASONING,
    totalCharacters: 10,
    ...overrides,
  }
}