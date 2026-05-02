import { describe, expect, it } from 'vitest'
import {
  buildContradictionResponse,
  buildExhaustedResponse,
  buildGuessResponse,
  buildQuestionResponse,
} from './_responses'

describe('game response builders', () => {
  it('buildGuessResponse includes readiness only when provided', () => {
    const base = buildGuessResponse({
      character: {
        id: 'mario',
        name: 'Mario',
        category: 'video-games',
        imageUrl: null,
      },
      confidence: 95,
      questionCount: 5,
      remaining: 2,
      guessCount: 1,
    })

    expect(base.type).toBe('guess')
    expect(base).not.toHaveProperty('readiness')

    const withReadiness = buildGuessResponse({
      character: {
        id: 'mario',
        name: 'Mario',
        category: 'video-games',
        imageUrl: null,
      },
      confidence: 95,
      questionCount: 5,
      remaining: 2,
      guessCount: 1,
      readiness: { trigger: 'strict_readiness', blockedByRejectCooldown: false },
    })

    expect(withReadiness).toHaveProperty('readiness')
  })

  it('buildQuestionResponse omits optional keys when undefined', () => {
    const response = buildQuestionResponse({
      question: { id: 'q1', text: 'Is human?', attribute: 'isHuman' },
      reasoning: { why: 'test' },
      remaining: 10,
      questionCount: 3,
    })

    expect(response.type).toBe('question')
    expect(response).not.toHaveProperty('eliminated')
    expect(response).not.toHaveProperty('readiness')
    expect(response).not.toHaveProperty('skippedCount')
  })

  it('buildContradictionResponse uses canonical contradiction message', () => {
    const response = buildContradictionResponse({
      question: { id: 'q1', text: 'Is human?', attribute: 'isHuman' },
      reasoning: { why: 'test' },
      remaining: 0,
      questionCount: 4,
    })

    expect(response.type).toBe('contradiction')
    expect(response.message).toContain('contradictory')
  })

  it('buildExhaustedResponse returns canonical exhausted payload shape', () => {
    const response = buildExhaustedResponse({
      message: 'No more candidates',
      questionCount: 7,
      guessCount: 2,
      rejectCooldownRemaining: 1,
    })

    expect(response).toEqual({
      type: 'exhausted',
      message: 'No more candidates',
      questionCount: 7,
      guessCount: 2,
      rejectCooldownRemaining: 1,
    })
  })
})
