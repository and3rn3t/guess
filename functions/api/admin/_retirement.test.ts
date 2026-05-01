import { describe, expect, it } from 'vitest'
import {
  computeRetirementQueue,
  parseRetirementParams,
  type RetirementAttemptRow,
  type RetirementSkipRow,
} from './_retirement'

const attempt = (over: Partial<RetirementAttemptRow> = {}): RetirementAttemptRow => ({
  question_id: 'q-1',
  text: 'Is the character human?',
  attribute_key: 'isHuman',
  shown: 20,
  yes: 8,
  no: 8,
  maybe: 2,
  unknown: 2,
  ...over,
})

describe('parseRetirementParams', () => {
  it('returns sensible defaults for empty params', () => {
    const p = parseRetirementParams(new URLSearchParams())
    expect(p).toEqual({ minShown: 10, limit: 50, windowDays: 30 })
  })

  it('clamps limit to [5, 500]', () => {
    expect(parseRetirementParams(new URLSearchParams('limit=1')).limit).toBe(5)
    expect(parseRetirementParams(new URLSearchParams('limit=99')).limit).toBe(99)
    expect(parseRetirementParams(new URLSearchParams('limit=999999')).limit).toBe(500)
    expect(parseRetirementParams(new URLSearchParams('limit=oops')).limit).toBe(50)
  })

  it('clamps windowDays to [1, 365]', () => {
    expect(parseRetirementParams(new URLSearchParams('windowDays=0')).windowDays).toBe(1)
    expect(parseRetirementParams(new URLSearchParams('windowDays=9999')).windowDays).toBe(365)
    expect(parseRetirementParams(new URLSearchParams('windowDays=7')).windowDays).toBe(7)
  })

  it('floors minShown at 1', () => {
    expect(parseRetirementParams(new URLSearchParams('minShown=0')).minShown).toBe(1)
    expect(parseRetirementParams(new URLSearchParams('minShown=200')).minShown).toBe(200)
  })
})

describe('computeRetirementQueue', () => {
  it('returns empty array for empty inputs', () => {
    expect(computeRetirementQueue([], [])).toEqual([])
  })

  it('drops rows whose question_id is null', () => {
    const rows = computeRetirementQueue([attempt({ question_id: null })], [])
    expect(rows).toEqual([])
  })

  it('drops rows below minShown', () => {
    const rows = computeRetirementQueue(
      [attempt({ shown: 3 }), attempt({ question_id: 'q-2', shown: 50 })],
      [],
      { minShown: 10 },
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].questionId).toBe('q-2')
  })

  it('computes skipRate from skips ÷ (shown + skips)', () => {
    const attempts = [attempt({ shown: 10, yes: 5, no: 5, maybe: 0 })]
    const skips: RetirementSkipRow[] = [{ question_id: 'q-1', skips: 5 }]
    const rows = computeRetirementQueue(attempts, skips)
    expect(rows[0].skipRate).toBe(0.3333) // 5 / 15 rounded
    expect(rows[0].skipped).toBe(5)
  })

  it('computes imbalance as | 0.5 − yes/(yes+no) | × 2 (perfect 50/50 = 0)', () => {
    const rows = computeRetirementQueue(
      [attempt({ shown: 20, yes: 10, no: 10, maybe: 0, unknown: 0 })],
      [],
    )
    expect(rows[0].imbalance).toBe(0)
  })

  it('returns imbalance 1 when answers are 100% one-sided', () => {
    const rows = computeRetirementQueue(
      [attempt({ shown: 20, yes: 20, no: 0, maybe: 0, unknown: 0 })],
      [],
    )
    expect(rows[0].imbalance).toBe(1)
  })

  it('clamps maybeRate to 1 even when maybe > shown is impossible (defensive)', () => {
    // shown=10, maybe=10 → maybeRate=1.0 (max realistic)
    const rows = computeRetirementQueue(
      [attempt({ shown: 10, yes: 0, no: 0, maybe: 10, unknown: 0 })],
      [],
    )
    expect(rows[0].maybeRate).toBe(1)
  })

  it('weights skipRate highest in the composite', () => {
    // q-skip:    skipRate=0.5, maybeRate=0,    imbalance=0     → score = 0.4 × 0.5 = 0.20
    // q-maybe:   skipRate=0,   maybeRate=0.3,  imbalance=0.143 → score ≈ 0.13
    // q-skewed:  skipRate=0,   maybeRate=0,    imbalance=0.4   → score = 0.12
    const rows = computeRetirementQueue(
      [
        attempt({ question_id: 'q-skip', shown: 10, yes: 5, no: 5, maybe: 0, unknown: 0 }),
        attempt({ question_id: 'q-maybe', shown: 10, yes: 4, no: 3, maybe: 3, unknown: 0 }),
        attempt({ question_id: 'q-skewed', shown: 10, yes: 7, no: 3, maybe: 0, unknown: 0 }),
      ],
      [{ question_id: 'q-skip', skips: 10 }],
    )
    expect(rows[0].questionId).toBe('q-skip')
    expect(rows[0].retirementScore).toBeCloseTo(0.2, 4)
  })

  it('breaks score ties by shown DESC', () => {
    // Both questions: skipRate=0.5, score=0.20 — but q-big has more shown.
    const rows = computeRetirementQueue(
      [
        attempt({ question_id: 'q-small', shown: 10, yes: 5, no: 5, maybe: 0 }),
        attempt({ question_id: 'q-big', shown: 100, yes: 50, no: 50, maybe: 0 }),
      ],
      [
        { question_id: 'q-small', skips: 10 },
        { question_id: 'q-big', skips: 100 },
      ],
    )
    expect(rows.map((r) => r.questionId)).toEqual(['q-big', 'q-small'])
  })

  it('respects the limit', () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      attempt({ question_id: `q-${i}`, shown: 10 + i }),
    )
    const rows = computeRetirementQueue(attempts, [], { limit: 3 })
    expect(rows).toHaveLength(3)
  })
})
