import { describe, expect, it } from 'vitest'
import { buildServerSkipActionPlan } from './server-skip'

describe('buildServerSkipActionPlan', () => {
  it('returns set-exhausted for null response', () => {
    expect(buildServerSkipActionPlan(null)).toEqual([{ type: 'set-exhausted' }])
  })

  it('returns set-exhausted for undefined response', () => {
    expect(buildServerSkipActionPlan(undefined)).toEqual([{ type: 'set-exhausted' }])
  })

  it('returns set-exhausted when question is missing', () => {
    expect(buildServerSkipActionPlan({ reasoning: 'r' })).toEqual([{ type: 'set-exhausted' }])
  })

  it('returns set-exhausted when reasoning is missing', () => {
    expect(buildServerSkipActionPlan({ question: { text: 'Q?' } })).toEqual([
      { type: 'set-exhausted' },
    ])
  })

  it('returns set-question for valid response', () => {
    const plan = buildServerSkipActionPlan({
      question: { text: 'Is it a person?' },
      reasoning: 'high entropy attribute',
    })
    expect(plan).toEqual([
      {
        type: 'set-question',
        question: { text: 'Is it a person?' },
        reasoning: 'high entropy attribute',
      },
    ])
  })
})
