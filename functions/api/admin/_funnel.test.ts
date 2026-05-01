import { describe, it, expect } from 'vitest'
import { computePerQuestionFunnel, type AttemptRow, type SkipRow } from './_funnel'

const attempt = (over: Partial<AttemptRow> = {}): AttemptRow => ({
  question_id: 'q-1',
  text: 'Is the character human?',
  shown: 10,
  yes: 4,
  no: 4,
  maybe: 1,
  unknown: 1,
  ...over,
})

describe('computePerQuestionFunnel', () => {
  it('returns empty array for empty inputs', () => {
    expect(computePerQuestionFunnel([], [])).toEqual([])
  })

  it('combines shown counts with skip counts', () => {
    const attempts: AttemptRow[] = [attempt({ question_id: 'q-1', shown: 10, maybe: 0 })]
    const skips: SkipRow[] = [{ question_id: 'q-1', skips: 2 }]
    const rows = computePerQuestionFunnel(attempts, skips)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      questionId: 'q-1',
      shown: 10,
      skipped: 2,
      skipRate: 0.1667, // 2/12 rounded
      maybeRate: 0,
    })
    expect(rows[0].skipRate).toBeCloseTo(0.1667, 4)
  })

  it('computes maybeRate from answer mix', () => {
    const attempts: AttemptRow[] = [attempt({ shown: 10, yes: 4, no: 4, maybe: 2, unknown: 0 })]
    const rows = computePerQuestionFunnel(attempts, [])
    expect(rows[0].maybeRate).toBe(0.2)
    expect(rows[0].skipRate).toBe(0)
    // 0.6 × 0 + 0.4 × 0.2 = 0.08
    expect(rows[0].frustrationScore).toBe(0.08)
  })

  it('weights skipRate higher than maybeRate in frustrationScore', () => {
    const attempts: AttemptRow[] = [attempt({ shown: 10, maybe: 5 })] // maybeRate=0.5
    const skips: SkipRow[] = [{ question_id: 'q-1', skips: 10 }] // skipRate=10/20=0.5
    const rows = computePerQuestionFunnel(attempts, skips)
    // 0.6 × 0.5 + 0.4 × 0.5 = 0.5
    expect(rows[0].frustrationScore).toBe(0.5)
  })

  it('handles question with zero shown but skips by dropping it', () => {
    // No attempt rows means the question never reached the answer panel.
    // Skip-only entries are dropped — they reflect unrelated client events.
    const skips: SkipRow[] = [{ question_id: 'q-orphan', skips: 5 }]
    expect(computePerQuestionFunnel([], skips)).toEqual([])
  })

  it('drops null question IDs (legacy attribute-only attempts)', () => {
    const attempts: AttemptRow[] = [
      attempt({ question_id: null, shown: 100 }),
      attempt({ question_id: 'q-real', shown: 5 }),
    ]
    const rows = computePerQuestionFunnel(attempts, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].questionId).toBe('q-real')
  })

  it('respects minShown threshold', () => {
    const attempts: AttemptRow[] = [
      attempt({ question_id: 'q-low', shown: 2 }),
      attempt({ question_id: 'q-high', shown: 50 }),
    ]
    const rows = computePerQuestionFunnel(attempts, [], { minShown: 5 })
    expect(rows.map((r) => r.questionId)).toEqual(['q-high'])
  })

  it('sorts by frustrationScore DESC then shown DESC', () => {
    const attempts: AttemptRow[] = [
      attempt({ question_id: 'q-calm', shown: 100, maybe: 0 }),
      attempt({ question_id: 'q-spike', shown: 10, maybe: 5 }),
      attempt({ question_id: 'q-mid', shown: 50, maybe: 10 }),
    ]
    const rows = computePerQuestionFunnel(attempts, [])
    expect(rows.map((r) => r.questionId)).toEqual(['q-spike', 'q-mid', 'q-calm'])
  })

  it('breaks frustrationScore ties by shown DESC', () => {
    const attempts: AttemptRow[] = [
      attempt({ question_id: 'q-small', shown: 10, maybe: 1 }),
      attempt({ question_id: 'q-big', shown: 1000, maybe: 100 }),
    ]
    const rows = computePerQuestionFunnel(attempts, [])
    // both maybeRate = 0.1, skipRate = 0 → same score. Bigger sample wins.
    expect(rows.map((r) => r.questionId)).toEqual(['q-big', 'q-small'])
  })

  it('clamps skipRate / maybeRate into [0, 1] defensively', () => {
    // Synthetic row where maybe > shown — shouldn't happen but the fn defends.
    const attempts: AttemptRow[] = [attempt({ shown: 10, maybe: 25 })]
    const rows = computePerQuestionFunnel(attempts, [])
    expect(rows[0].maybeRate).toBe(1)
    expect(rows[0].frustrationScore).toBeLessThanOrEqual(1)
  })

  it('aggregates duplicate skip rows for the same question', () => {
    const attempts: AttemptRow[] = [attempt({ shown: 10 })]
    const skips: SkipRow[] = [
      { question_id: 'q-1', skips: 2 },
      { question_id: 'q-1', skips: 3 },
    ]
    const rows = computePerQuestionFunnel(attempts, skips)
    expect(rows[0].skipped).toBe(5)
  })

  it('rounds rates to 4 decimals', () => {
    const attempts: AttemptRow[] = [attempt({ shown: 7, maybe: 1, yes: 6, no: 0, unknown: 0 })]
    const rows = computePerQuestionFunnel(attempts, [])
    // 1/7 = 0.142857… → 0.1429
    expect(rows[0].maybeRate).toBe(0.1429)
  })
})
