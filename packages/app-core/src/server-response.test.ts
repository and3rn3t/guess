import { describe, expect, it } from 'vitest'

import { buildServerAnswerActionPlan, buildServerAnswerOutcome } from './server-response'

describe('buildServerAnswerOutcome', () => {
  it('returns contradiction outcome with default message fallback', () => {
    const outcome = buildServerAnswerOutcome({
      type: 'contradiction',
    })

    expect(outcome).toEqual({
      kind: 'contradiction',
      message: 'Contradictory answers — undoing last answer.',
      question: undefined,
      reasoning: undefined,
    })
  })

  it('returns normalized guess outcome with default remaining', () => {
    const outcome = buildServerAnswerOutcome({
      type: 'guess',
      character: {
        id: 'mario',
        name: 'Mario',
        imageUrl: null,
      },
    })

    expect(outcome).toEqual({
      kind: 'guess',
      character: {
        id: 'mario',
        name: 'Mario',
        category: 'other',
        imageUrl: undefined,
        trivia: undefined,
      },
      remaining: 1,
      readiness: undefined,
    })
  })

  it('returns question outcome with preserved payload', () => {
    const question = { id: 'q1', text: 'Can fly?', attribute: 'canFly' }
    const reasoning = {
      why: 'narrows candidates',
      impact: '30%',
      remaining: 7,
      confidence: 30,
      topCandidates: [],
    }
    const readiness = {
      trigger: 'insufficient_data',
      blockedByRejectCooldown: true,
      rejectCooldownRemaining: 2,
    }

    const outcome = buildServerAnswerOutcome({
      type: 'question',
      question,
      reasoning,
      remaining: 7,
      readiness,
    })

    expect(outcome).toEqual({
      kind: 'question',
      question,
      reasoning,
      remaining: 7,
      readiness,
    })
  })
})

describe('buildServerAnswerActionPlan', () => {
  it('returns undo then set-question for contradiction with recovery payload', () => {
    const question = { id: 'q1', text: 'Is human?', attribute: 'isHuman' }
    const reasoning = {
      why: 'recovered',
      impact: '20%',
      remaining: 8,
      confidence: 20,
      topCandidates: [],
    }

    expect(
      buildServerAnswerActionPlan({
        kind: 'contradiction',
        message: 'Contradiction',
        question,
        reasoning,
      }),
    ).toEqual([
      { type: 'undo-last-answer' },
      { type: 'set-question', question, reasoning },
    ])
  })

  it('returns make-guess for guess outcome', () => {
    expect(
      buildServerAnswerActionPlan({
        kind: 'guess',
        remaining: 1,
        character: {
          id: 'mario',
          name: 'Mario',
          category: 'video-games',
        },
      }),
    ).toEqual([
      {
        type: 'make-guess',
        character: {
          id: 'mario',
          name: 'Mario',
          category: 'video-games',
        },
      },
    ])
  })

  it('returns set-question for question outcome', () => {
    const question = { id: 'q2', text: 'Can fly?', attribute: 'canFly' }
    const reasoning = {
      why: 'next question',
      impact: '30%',
      remaining: 7,
      confidence: 30,
      topCandidates: [],
    }

    expect(
      buildServerAnswerActionPlan({
        kind: 'question',
        question,
        reasoning,
      }),
    ).toEqual([{ type: 'set-question', question, reasoning }])
  })
})