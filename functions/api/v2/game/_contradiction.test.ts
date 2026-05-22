import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSession } from '../_game-engine'

const { generateReasoningMock, saveSessionStateMock } = vi.hoisted(() => ({
  generateReasoningMock: vi.fn(),
  saveSessionStateMock: vi.fn(),
}))

vi.mock('../_game-engine', async () => {
  const actual = await vi.importActual<typeof import('../_game-engine')>('../_game-engine')
  return {
    ...actual,
    generateReasoning: generateReasoningMock,
    saveSessionState: saveSessionStateMock,
  }
})

import { rollbackAndBuildContradictionResponse } from './_contradiction'

function makeSession(): GameSession {
  return {
    id: 'sess-1',
    characters: [
      { id: 'a', name: 'Alpha', category: 'test', imageUrl: null, attributes: { isHuman: true } },
    ],
    questions: [
      { id: 'q1', text: 'Is human?', attribute: 'isHuman', category: 'traits' },
    ],
    answers: [{ questionId: 'isHuman', value: 'yes' }],
    currentQuestion: { id: 'q1', text: 'Is human?', attribute: 'isHuman', category: 'traits' },
    difficulty: 'medium',
    maxQuestions: 15,
    createdAt: Date.now(),
    rejectedGuesses: [],
    skippedQuestions: [],
    guessCount: 0,
    postRejectCooldown: 0,
  }
}

describe('rollbackAndBuildContradictionResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveSessionStateMock.mockResolvedValue(undefined)
    generateReasoningMock.mockReturnValue({ why: 'contradiction' })
  })

  it('pops the latest answer, saves state, and builds contradiction payload', async () => {
    const session = makeSession()
    const response = await rollbackAndBuildContradictionResponse({
      db: {} as D1Database,
      session,
    })

    expect(session.answers).toEqual([])
    expect(saveSessionStateMock).toHaveBeenCalledWith(expect.any(Object), session)
    expect(generateReasoningMock).toHaveBeenCalledWith(session.currentQuestion, session.characters, session.answers)
    expect(response.type).toBe('contradiction')
    expect(response.questionCount).toBe(0)
  })
})
