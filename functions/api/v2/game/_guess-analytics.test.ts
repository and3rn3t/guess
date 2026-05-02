import { describe, expect, it } from 'vitest'
import { buildGuessAnalytics } from './_guess-analytics'

describe('buildGuessAnalytics', () => {
  it('builds rounded analytics payload with answer distribution', () => {
    const analytics = buildGuessAnalytics({
      guessId: 'mario',
      probs: new Map([
        ['mario', 0.954],
        ['luigi', 0.046],
      ]),
      answers: [
        { questionId: 'isHuman', value: 'yes' },
        { questionId: 'canFly', value: 'no' },
        { questionId: 'isPlumber', value: 'yes' },
      ],
      remaining: 2,
      readiness: {
        trigger: 'strict_readiness',
        forced: false,
        gap: 0.9087,
        aliveCount: 2,
        questionsRemaining: 11,
      },
    })

    expect(analytics).toEqual({
      confidence: 0.95,
      entropy: 0.27,
      remaining: 2,
      answerDistribution: { yes: 2, no: 1, maybe: 0, unknown: 0 },
      trigger: 'strict_readiness',
      forced: false,
      gap: 0.91,
      aliveCount: 2,
      questionsRemaining: 11,
    })
  })

  it('defaults confidence to 0 when guess id is missing', () => {
    const analytics = buildGuessAnalytics({
      guessId: 'missing',
      probs: new Map([['mario', 1]]),
      answers: [],
      remaining: 1,
      readiness: {},
    })

    expect(analytics.confidence).toBe(0)
    expect(analytics.answerDistribution).toEqual({ yes: 0, no: 0, maybe: 0, unknown: 0 })
  })
})
