import { beforeEach, describe, expect, it, vi } from 'vitest'

const { d1RunMock } = vi.hoisted(() => ({
  d1RunMock: vi.fn(),
}))

vi.mock('../../_helpers', () => ({
  d1Run: d1RunMock,
}))

import {
  buildQuestionAttemptInput,
  queueAnswerSessionSync,
  queueQuestionAttemptWrite,
  queueRejectSessionSync,
} from './_turn-effects'

describe('turn side-effect adapters', () => {
  const waitUntil = vi.fn<(promise: Promise<unknown>) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    d1RunMock.mockResolvedValue(undefined)
  })

  it('queues question_attempts write when db is present', () => {
    queueQuestionAttemptWrite(waitUntil, {} as D1Database, {
      sessionId: 'sess-1',
      questionId: 'q1',
      attribute: 'isHuman',
      answer: 'yes',
      candidatesBefore: 100,
      candidatesAfter: 60,
      questionIndex: 0,
      createdAt: 123,
    })

    expect(d1RunMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('INSERT INTO question_attempts'),
      ['sess-1', 'q1', 'isHuman', 'yes', 100, 60, 0, 123],
    )
    expect(waitUntil).toHaveBeenCalledOnce()
  })

  it('does nothing when db is absent', () => {
    queueAnswerSessionSync(waitUntil, null, {
      sessionId: 'sess-1',
      answersJson: '[]',
      currentQuestionAttr: 'isHuman',
    })

    expect(d1RunMock).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('queues reject-session sync write with max questions', () => {
    queueRejectSessionSync(waitUntil, {} as D1Database, {
      sessionId: 'sess-1',
      currentQuestionAttr: 'canFly',
      maxQuestions: 18,
    })

    expect(d1RunMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('UPDATE game_sessions SET current_question_attr = ?, max_questions = ?'),
      ['canFly', 18, 'sess-1'],
    )
    expect(waitUntil).toHaveBeenCalledOnce()
  })

  it('builds question_attempt payload from asked question shape', () => {
    const payload = buildQuestionAttemptInput({
      sessionId: 'sess-1',
      askedQuestion: { id: 'q1', attribute: 'isHuman' },
      answer: 'yes',
      candidatesBefore: 100,
      candidatesAfter: 50,
      questionIndex: 2,
      createdAt: 123,
    })

    expect(payload).toEqual({
      sessionId: 'sess-1',
      questionId: 'q1',
      attribute: 'isHuman',
      answer: 'yes',
      candidatesBefore: 100,
      candidatesAfter: 50,
      questionIndex: 2,
      createdAt: 123,
    })
  })
})
