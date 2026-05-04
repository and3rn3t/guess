import { describe, expect, it } from 'vitest'

import { buildResumeBootstrapPlan, buildStartBootstrapPlan } from './server-bootstrap'

describe('buildStartBootstrapPlan', () => {
  it('returns start-game followed by current question', () => {
    const question = { id: 'q1', text: 'Is human?', attribute: 'isHuman' }
    const reasoning = {
      why: 'narrowing candidates',
      impact: '20%',
      remaining: 10,
      confidence: 20,
      topCandidates: [],
    }

    expect(buildStartBootstrapPlan({ question, reasoning })).toEqual([
      { type: 'start-game' },
      { type: 'set-question', question, reasoning },
    ])
  })
})

describe('buildResumeBootstrapPlan', () => {
  it('returns start-game, replay steps, and current question in order', () => {
    const question = { id: 'q2', text: 'Can fly?', attribute: 'canFly' }
    const reasoning = {
      why: 'follow-up',
      impact: '30%',
      remaining: 7,
      confidence: 30,
      topCandidates: [],
    }

    expect(
      buildResumeBootstrapPlan({
        question,
        reasoning,
        guessCount: 2,
        answers: [{ questionId: 'q1', value: 'yes' as const }],
      }),
    ).toEqual([
      { type: 'start-game', guessCount: 2 },
      {
        type: 'set-question',
        question: { id: 'q1', text: '', attribute: 'q1' },
        reasoning: {
          why: '',
          impact: '',
          remaining: 0,
          confidence: 0,
          topCandidates: [],
        },
      },
      { type: 'answer', value: 'yes' },
      { type: 'set-question', question, reasoning },
    ])
  })
})