import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSession } from '../_game-engine'

const {
  saveSessionStateMock,
  getBestGuessResultMock,
  buildGuessAnalyticsMock,
} = vi.hoisted(() => ({
  saveSessionStateMock: vi.fn(),
  getBestGuessResultMock: vi.fn(),
  buildGuessAnalyticsMock: vi.fn(),
}))

vi.mock('../_game-engine', async () => {
  const actual = await vi.importActual<typeof import('../_game-engine')>('../_game-engine')
  return {
    ...actual,
    getBestGuessResult: getBestGuessResultMock,
    saveSessionState: saveSessionStateMock,
  }
})

vi.mock('./_guess-analytics', () => ({
  buildGuessAnalytics: buildGuessAnalyticsMock,
}))

import { finalizeGuessAndSave } from './_guess-flow'
import { finalizeBestGuessForSession } from './_guess-flow'
import { selectBestGuessForSession } from './_guess-flow'

function makeSession(): GameSession {
  return {
    id: 'sess-1',
    characters: [],
    questions: [
      { id: 'q1', text: 'Is human?', attribute: 'isHuman' },
    ],
    answers: [{ questionId: 'isHuman', value: 'yes' }],
    currentQuestion: null,
    difficulty: 'medium',
    maxQuestions: 15,
    createdAt: Date.now(),
    rejectedGuesses: [],
    skippedQuestions: [],
    guessCount: 0,
    postRejectCooldown: 0,
    persona: 'watson',
  }
}

describe('selectBestGuessForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBestGuessResultMock.mockReturnValue({
      character: null,
      confidence: 0,
      probs: new Map(),
    })
  })

  it('delegates guess selection with answers and rejected guesses from session', () => {
    const session = makeSession()
    session.answers = [{ questionId: 'isHuman', value: 'yes' }]
    session.rejectedGuesses = ['b']
    const filtered = [
      { id: 'a', name: 'A', category: 'test', imageUrl: null, attributes: {} },
    ]
    const scoring = {
      coverageMap: {},
      popularityMap: {},
    }

    selectBestGuessForSession(session, filtered, scoring as never)

    expect(getBestGuessResultMock).toHaveBeenCalledWith(
      filtered,
      session.answers,
      session.rejectedGuesses,
      scoring,
    )
  })
})

describe('finalizeGuessAndSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveSessionStateMock.mockResolvedValue(undefined)
  })

  it('clears current question, increments guess count, saves, and returns guess payload', async () => {
    const session = makeSession()
    session.currentQuestion = {
      id: 'q1',
      text: 'Is human?',
      attribute: 'isHuman',
      category: 'traits',
    }

    const response = await finalizeGuessAndSave({
      db: {} as D1Database,
      session,
      guess: {
        id: 'a',
        name: 'Alpha',
        category: 'test',
        imageUrl: null,
        attributes: {},
      },
      probs: new Map([['a', 0.92]]),
      questionCount: 3,
      remaining: 5,
      readiness: { trigger: 'strict_readiness' },
    })

    expect(session.currentQuestion).toBeNull()
    expect(session.guessCount).toBe(1)
    expect(saveSessionStateMock).toHaveBeenCalledWith(expect.any(Object), session)
    expect(response).toEqual(expect.objectContaining({
      type: 'guess',
      confidence: 92,
      questionCount: 3,
      remaining: 5,
      guessCount: 1,
      readiness: { trigger: 'strict_readiness' },
    }))
    expect(response.character).toEqual(expect.objectContaining({ id: 'a', name: 'Alpha' }))
  })
})

describe('finalizeBestGuessForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveSessionStateMock.mockResolvedValue(undefined)
    getBestGuessResultMock.mockReturnValue({
      character: null,
      confidence: 0,
      probs: new Map(),
    })
    buildGuessAnalyticsMock.mockReturnValue({ confidence: 0.9 })
  })

  it('returns null when no best guess is available', async () => {
    const session = makeSession()
    const response = await finalizeBestGuessForSession({
      db: {} as D1Database,
      session,
      filtered: [],
      scoring: { coverageMap: {}, popularityMap: {} } as never,
      questionCount: 2,
      remaining: 0,
    })

    expect(response).toBeNull()
    expect(saveSessionStateMock).not.toHaveBeenCalled()
  })

  it('records analytics and returns finalized guess response when available', async () => {
    const session = makeSession()
    getBestGuessResultMock.mockReturnValue({
      character: { id: 'a', name: 'Alpha', category: 'test', imageUrl: null },
      confidence: 0.9,
      probs: new Map([['a', 0.9]]),
    })

    const response = await finalizeBestGuessForSession({
      db: {} as D1Database,
      session,
      filtered: [{ id: 'a', name: 'Alpha', category: 'test', imageUrl: null, attributes: {} }],
      scoring: { coverageMap: {}, popularityMap: {} } as never,
      questionCount: 3,
      remaining: 1,
      readiness: { trigger: 'strict_readiness' },
      recordAnalytics: true,
    })

    expect(buildGuessAnalyticsMock).toHaveBeenCalledWith(expect.objectContaining({
      guessId: 'a',
      remaining: 1,
      readiness: { trigger: 'strict_readiness' },
    }))
    expect(session.guessAnalytics).toEqual({ confidence: 0.9 })
    expect(response).toEqual(expect.objectContaining({
      type: 'guess',
      character: expect.objectContaining({ id: 'a' }),
      questionCount: 3,
      remaining: 1,
    }))
  })
})
