import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSession, ServerQuestion } from '../_game-engine'

const {
  saveSessionStateMock,
  rephraseQuestionMock,
  generateReasoningMock,
  calculateEliminatedCountMock,
  queueAnswerSessionSyncMock,
} = vi.hoisted(() => ({
  saveSessionStateMock: vi.fn(),
  rephraseQuestionMock: vi.fn(),
  generateReasoningMock: vi.fn(),
  calculateEliminatedCountMock: vi.fn(),
  queueAnswerSessionSyncMock: vi.fn(),
}))

vi.mock('../_game-engine', async () => {
  const actual = await vi.importActual<typeof import('../_game-engine')>('../_game-engine')
  return {
    ...actual,
    generateReasoning: generateReasoningMock,
    saveSessionState: saveSessionStateMock,
  }
})

vi.mock('./_elimination', () => ({
  calculateEliminatedCount: calculateEliminatedCountMock,
}))

vi.mock('../_llm-rephrase', () => ({
  rephraseQuestion: rephraseQuestionMock,
}))

vi.mock('./_turn-effects', async () => {
  const actual = await vi.importActual<typeof import('./_turn-effects')>('./_turn-effects')
  return {
    ...actual,
    queueAnswerSessionSync: queueAnswerSessionSyncMock,
  }
})

import { advanceToNextQuestion } from './_question-flow'
import { applyAnswerAndFilter } from './_question-flow'
import { buildNextQuestionResponse } from './_question-flow'
import { persistAndSyncAnswerTurn } from './_question-flow'

function makeSession(): GameSession {
  return {
    id: 'sess-1',
    characters: [],
    questions: [
      { id: 'q1', text: 'Is human?', attribute: 'isHuman' },
      { id: 'q2', text: 'Can fly?', attribute: 'canFly' },
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

describe('advanceToNextQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveSessionStateMock.mockResolvedValue(undefined)
    rephraseQuestionMock.mockResolvedValue(null)
    generateReasoningMock.mockReturnValue({
      why: 'test rationale',
      impact: 'test impact',
      remaining: 0,
      confidence: 70,
      topCandidates: [],
    })
    calculateEliminatedCountMock.mockReturnValue(3)
  })

  it('sets current question, saves session, and applies rephrased text when available', async () => {
    const session = makeSession()
    const nextQuestion: ServerQuestion = { id: 'q3', text: 'Is magical?', attribute: 'isMagical' }
    const reasoning = {
      why: 'focused split',
      impact: 'reduces uncertainty',
      remaining: 4,
      confidence: 74,
      topCandidates: [{ name: 'A', probability: 0.74 }],
    }
    rephraseQuestionMock.mockResolvedValue('Could they be magical?')

    await advanceToNextQuestion({
      env: {} as never,
      kv: {} as KVNamespace,
      session,
      nextQuestion,
      reasoning,
      questionNumber: 2,
    })

    expect(session.currentQuestion).toBe(nextQuestion)
    expect(saveSessionStateMock).toHaveBeenCalledWith(expect.any(Object), session)
    expect(rephraseQuestionMock).toHaveBeenCalledWith(
      expect.any(Object),
      nextQuestion,
      session.answers,
      reasoning,
      2,
      session.maxQuestions,
      expect.any(Map),
      session.persona,
    )
    expect(nextQuestion.displayText).toBe('Could they be magical?')
  })

  it('keeps original question text when rephrase returns null', async () => {
    const session = makeSession()
    const nextQuestion: ServerQuestion = { id: 'q3', text: 'Is magical?', attribute: 'isMagical' }
    const reasoning = {
      why: 'fallback wording',
      impact: 'keeps progress',
      remaining: 3,
      confidence: 52,
      topCandidates: [],
    }

    await advanceToNextQuestion({
      env: {} as never,
      kv: {} as KVNamespace,
      session,
      nextQuestion,
      reasoning,
      questionNumber: 2,
    })

    expect(nextQuestion.displayText).toBeUndefined()
    expect(saveSessionStateMock).toHaveBeenCalledOnce()
    expect(rephraseQuestionMock).toHaveBeenCalledOnce()
  })
})

describe('applyAnswerAndFilter', () => {
  it('appends answer and returns candidates before/after snapshot', () => {
    const session = makeSession()
    session.characters = [
      { id: 'a', name: 'A', category: 'test', imageUrl: null, attributes: { isHuman: true } },
      { id: 'b', name: 'B', category: 'test', imageUrl: null, attributes: { isHuman: false } },
    ]
    session.answers = []
    session.currentQuestion = {
      id: 'q1',
      text: 'Is human?',
      attribute: 'isHuman',
      category: 'traits',
    }

    const result = applyAnswerAndFilter(session, 'yes')

    expect(result.askedQuestion.attribute).toBe('isHuman')
    expect(result.questionIndex).toBe(0)
    expect(result.candidatesBefore).toBe(2)
    expect(result.filtered.map((c) => c.id)).toEqual(['a', 'b'])
    expect(session.answers).toEqual([{ questionId: 'isHuman', value: 'yes' }])
  })
})

describe('buildNextQuestionResponse', () => {
  it('returns reasoning and shaped question response payload', () => {
    const session = makeSession()
    const nextQuestion: ServerQuestion = {
      id: 'q3',
      text: 'Is magical?',
      attribute: 'isMagical',
    }
    const filtered = [
      { id: 'a', name: 'Alpha', category: 'test', imageUrl: null, attributes: {} },
    ]
    const scoring = { coverageMap: {}, popularityMap: {} }

    const result = buildNextQuestionResponse({
      session,
      nextQuestion,
      filtered,
      scoring: scoring as never,
      questionCount: 4,
      readiness: { trigger: 'strict_readiness' },
    })

    expect(generateReasoningMock).toHaveBeenCalledWith(
      nextQuestion,
      filtered,
      session.answers,
      scoring,
    )
    expect(calculateEliminatedCountMock).toHaveBeenCalledWith(session, filtered.length)
    expect(result.response).toEqual(expect.objectContaining({
      type: 'question',
      question: nextQuestion,
      reasoning: expect.objectContaining({ confidence: 70, topCandidates: [] }),
      remaining: 1,
      eliminated: 3,
      questionCount: 4,
      readiness: { trigger: 'strict_readiness' },
    }))
  })
})

describe('persistAndSyncAnswerTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveSessionStateMock.mockResolvedValue(undefined)
    rephraseQuestionMock.mockResolvedValue(null)
  })

  it('advances question state and queues non-blocking answer sync', async () => {
    const session = makeSession()
    const nextQuestion: ServerQuestion = { id: 'q3', text: 'Is magical?', attribute: 'isMagical' }
    const reasoning = {
      why: 'persist turn',
      impact: 'advance game',
      remaining: 2,
      confidence: 65,
      topCandidates: [],
    }
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>()

    await persistAndSyncAnswerTurn({
      env: {} as never,
      kv: {} as KVNamespace,
      db: {} as D1Database,
      waitUntil,
      session,
      nextQuestion,
      reasoning,
      questionNumber: 2,
    })

    expect(session.currentQuestion).toBe(nextQuestion)
    expect(saveSessionStateMock).toHaveBeenCalledOnce()
    expect(queueAnswerSessionSyncMock).toHaveBeenCalledWith(
      waitUntil,
      expect.any(Object),
      {
        sessionId: session.id,
        answersJson: JSON.stringify(session.answers),
        currentQuestionAttr: nextQuestion.attribute,
      },
    )
  })
})
