import { describe, expect, it } from 'vitest'
import { buildServerRejectActionPlan } from './server-reject'

describe('buildServerRejectActionPlan', () => {
  it('returns set-exhausted step for exhausted response', () => {
    const plan = buildServerRejectActionPlan({ type: 'exhausted' })
    expect(plan).toEqual([{ type: 'set-exhausted' }])
  })

  it('returns set-question step for question response', () => {
    const plan = buildServerRejectActionPlan({
      type: 'question',
      question: { text: 'Is it fictional?' },
      reasoning: { explanation: 'based on prior answers' },
    })
    expect(plan).toEqual([
      {
        type: 'set-question',
        question: { text: 'Is it fictional?' },
        reasoning: { explanation: 'based on prior answers' },
      },
    ])
  })

  it('returns empty plan for unknown response shape', () => {
    const plan = buildServerRejectActionPlan({ type: 'unknown_type' })
    expect(plan).toEqual([])
  })

  it('returns empty plan for question response missing reasoning', () => {
    const plan = buildServerRejectActionPlan({ type: 'question', question: { text: 'Q?' } })
    expect(plan).toEqual([])
  })
})
