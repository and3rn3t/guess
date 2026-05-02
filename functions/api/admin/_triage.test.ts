import { describe, it, expect } from 'vitest'
import { computeMinRank, detectCatastrophicFailure, buildStepsJson } from './_triage'
import type { TopTenEntry } from './_triage'

const TOP10_WITH_A: TopTenEntry[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
]
const TOP10_WITHOUT_A: TopTenEntry[] = [
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Charlie' },
]

// ── computeMinRank ───────────────────────────────────────────────────────────

describe('computeMinRank', () => {
  it('returns null for empty stepTopTen', () => {
    expect(computeMinRank('a', [])).toBeNull()
  })

  it('returns null when character never appears', () => {
    expect(computeMinRank('z', [TOP10_WITH_A, TOP10_WITHOUT_A])).toBeNull()
  })

  it('returns 1 when character is first in one step', () => {
    expect(computeMinRank('a', [TOP10_WITH_A])).toBe(1)
  })

  it('returns 2 when character is second', () => {
    expect(computeMinRank('b', [TOP10_WITH_A])).toBe(2)
  })

  it('returns the best (lowest) rank across multiple steps', () => {
    const step1: TopTenEntry[] = [{ id: 'x', name: 'X' }, { id: 'a', name: 'Alice' }] // rank 2
    const step2: TopTenEntry[] = [{ id: 'a', name: 'Alice' }, { id: 'x', name: 'X' }] // rank 1
    expect(computeMinRank('a', [step1, step2])).toBe(1)
  })

  it('ignores steps where character is absent', () => {
    expect(computeMinRank('a', [TOP10_WITHOUT_A, TOP10_WITH_A])).toBe(1)
  })
})

// ── detectCatastrophicFailure ────────────────────────────────────────────────

describe('detectCatastrophicFailure', () => {
  it('returns false for empty stepTopTen', () => {
    expect(detectCatastrophicFailure('a', [])).toBe(false)
  })

  it('returns false when character appears in top10', () => {
    expect(detectCatastrophicFailure('a', [TOP10_WITH_A])).toBe(false)
  })

  it('returns true when character never appears', () => {
    expect(detectCatastrophicFailure('z', [TOP10_WITH_A, TOP10_WITHOUT_A])).toBe(true)
  })

  it('returns false when character appears in at least one step', () => {
    expect(detectCatastrophicFailure('a', [TOP10_WITHOUT_A, TOP10_WITH_A])).toBe(false)
  })
})

// ── buildStepsJson ───────────────────────────────────────────────────────────

describe('buildStepsJson', () => {
  const answers = [
    { questionId: 'isMale', value: 'yes' as const },
    { questionId: 'isHuman', value: 'no' as const },
  ]
  const questions = [
    { attribute: 'isMale', text: 'Is this character male?', displayText: undefined },
    { attribute: 'isHuman', text: 'Is this a human?', displayText: 'Is this character human?' },
  ]
  const stepTopTen: TopTenEntry[][] = [TOP10_WITH_A, TOP10_WITHOUT_A]

  it('maps answers to steps with correct attrs and answers', () => {
    const steps = buildStepsJson(answers, questions, stepTopTen)
    expect(steps).toHaveLength(2)
    expect(steps[0].attr).toBe('isMale')
    expect(steps[0].answer).toBe('yes')
    expect(steps[1].attr).toBe('isHuman')
    expect(steps[1].answer).toBe('no')
  })

  it('uses displayText when available, falls back to text', () => {
    const steps = buildStepsJson(answers, questions, stepTopTen)
    expect(steps[0].questionText).toBe('Is this character male?') // no displayText
    expect(steps[1].questionText).toBe('Is this character human?') // uses displayText
  })

  it('attaches top10 from corresponding step', () => {
    const steps = buildStepsJson(answers, questions, stepTopTen)
    expect(steps[0].top10).toEqual(TOP10_WITH_A)
    expect(steps[1].top10).toEqual(TOP10_WITHOUT_A)
  })

  it('uses empty top10 for steps beyond stepTopTen length', () => {
    const steps = buildStepsJson(answers, questions, [TOP10_WITH_A])
    expect(steps[1].top10).toEqual([])
  })

  it('falls back to questionId when question not found', () => {
    const steps = buildStepsJson(
      [{ questionId: 'unknownAttr', value: 'yes' as const }],
      [],
      [[]]
    )
    expect(steps[0].questionText).toBe('unknownAttr')
  })
})
