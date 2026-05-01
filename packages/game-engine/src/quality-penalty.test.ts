import { describe, expect, it } from 'vitest'
import { buildQualityPenaltyMap, computeQualityPenalty } from './quality-penalty'

describe('computeQualityPenalty', () => {
  it('returns null when shown is below minShown', () => {
    expect(computeQualityPenalty({ shown: 5, skipped: 0, yes: 3, no: 2, maybe: 0 })).toBeNull()
    expect(
      computeQualityPenalty({ shown: 5, skipped: 0, yes: 3, no: 2, maybe: 0 }, { minShown: 5 }),
    ).not.toBeNull()
  })

  it('returns 1.0 for a perfectly balanced, never-skipped question', () => {
    const p = computeQualityPenalty({ shown: 100, skipped: 0, yes: 50, no: 50, maybe: 0 })
    expect(p).toBe(1)
  })

  it('drops the multiplier as skipRate climbs (skipRate dominates)', () => {
    // shown=20, skipped=20 → skipRate=0.5; yes=10/no=10/maybe=0
    // badness = 0.4 × 0.5 = 0.2 → multiplier = 0.8
    const p = computeQualityPenalty({ shown: 20, skipped: 20, yes: 10, no: 10, maybe: 0 })
    expect(p).toBeCloseTo(0.8, 4)
  })

  it('penalises one-sided answer distributions (imbalance term)', () => {
    // shown=20 yes=18 no=2 maybe=0 skipped=0 → imbalance = |0.5-0.9|*2 = 0.8
    // badness = 0.3 × 0.8 = 0.24 → multiplier = 0.76
    const p = computeQualityPenalty({ shown: 20, skipped: 0, yes: 18, no: 2, maybe: 0 })
    expect(p).toBeCloseTo(0.76, 4)
  })

  it('penalises high maybe rates', () => {
    // shown=20 maybe=10 yes=5 no=5 skipped=0 → maybeRate=0.5, imbalance=0
    // badness = 0.3 × 0.5 = 0.15 → multiplier = 0.85
    const p = computeQualityPenalty({ shown: 20, skipped: 0, yes: 5, no: 5, maybe: 10 })
    expect(p).toBeCloseTo(0.85, 4)
  })

  it('clamps the multiplier at the floor for catastrophically bad questions', () => {
    // shown=10 skipped=100 yes=10 no=0 maybe=0
    // skipRate ≈ 0.909, maybeRate=0, imbalance=1
    // badness = 0.4 × 0.909 + 0.3 × 1 = 0.664 → raw multiplier ≈ 0.336
    // floor=0.3 lets that through; bump alpha=2 → raw ≈ -0.328 → clamped to 0.3
    const p = computeQualityPenalty(
      { shown: 10, skipped: 100, yes: 10, no: 0, maybe: 0 },
      { alpha: 2 },
    )
    expect(p).toBe(0.3)
  })

  it('respects a custom floor', () => {
    const p = computeQualityPenalty(
      { shown: 10, skipped: 100, yes: 10, no: 0, maybe: 0 },
      { alpha: 5, floor: 0.5 },
    )
    expect(p).toBe(0.5)
  })

  it('treats negative skipped as zero (defensive)', () => {
    const p = computeQualityPenalty({ shown: 100, skipped: -10, yes: 50, no: 50, maybe: 0 })
    expect(p).toBe(1)
  })

  it('returns 0-imbalance when yes+no is zero', () => {
    // All maybe → imbalance 0, maybeRate 1.0, skipRate 0
    // badness = 0.3 × 1 = 0.3 → multiplier = 0.7
    const p = computeQualityPenalty({ shown: 20, skipped: 0, yes: 0, no: 0, maybe: 20 })
    expect(p).toBeCloseTo(0.7, 4)
  })
})

describe('buildQualityPenaltyMap', () => {
  it('omits attributes with multiplier === 1 (keeps the KV blob small)', () => {
    const map = buildQualityPenaltyMap({
      goodAttr: { shown: 100, skipped: 0, yes: 50, no: 50, maybe: 0 },
      badAttr: { shown: 20, skipped: 20, yes: 10, no: 10, maybe: 0 },
    })
    expect(Object.keys(map)).toEqual(['badAttr'])
    expect(map.badAttr).toBeCloseTo(0.8, 4)
  })

  it('omits attributes that fall below minShown', () => {
    const map = buildQualityPenaltyMap({
      noisyAttr: { shown: 2, skipped: 50, yes: 1, no: 1, maybe: 0 },
    })
    expect(map).toEqual({})
  })
})
