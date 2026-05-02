import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSession, ServerQuestion } from '../_game-engine'

const { saveSessionStateMock, rephraseQuestionMock } = vi.hoisted(() => ({
  saveSessionStateMock: vi.fn(),
  rephraseQuestionMock: vi.fn(),
}))

vi.mock('../_game-engine', async () => {
  const actual = await vi.importActual<typeof import('../_game-engine')>('../_game-engine')
  return {
    ...actual,
    saveSessionState: saveSessionStateMock,
  }
})

vi.mock('../_llm-rephrase', () => ({
  rephraseQuestion: rephraseQuestionMock,
}))

import { advanceToNextQuestion } from './_question-flow'
import { applyAnswerAndFilter } from './_question-flow'

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
  })

  it('sets current question, saves session, and applies rephrased text when available', async () => {
    const session = makeSession()
    const nextQuestion: ServerQuestion = { id: 'q3', text: 'Is magical?', attribute: 'isMagical' }
    const reasoning = { confidence: 74, topCandidates: [{ id: 'c1', name: 'A', probability: 0.74 }] }
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
    const reasoning = { confidence: 52, topCandidates: [] }

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
