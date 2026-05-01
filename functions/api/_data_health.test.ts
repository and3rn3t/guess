import { describe, it, expect } from 'vitest'
import { computeDataHealthScore } from './_data_health'

describe('computeDataHealthScore', () => {
  it('returns 0 for an empty database', () => {
    const r = computeDataHealthScore({
      coveragePct: 0,
      evidencePct: 0,
      agreementAvg: 0,
      openDisputes: 0,
      attributeRows: 0,
    })
    // disputeHealth = 1 (0/1 density), weighted by 0.15 → 15.0
    expect(r.score).toBe(15)
  })

  it('returns 100 for a perfect-quality database with no disputes', () => {
    const r = computeDataHealthScore({
      coveragePct: 1,
      evidencePct: 1,
      agreementAvg: 1,
      openDisputes: 0,
      attributeRows: 1000,
    })
    expect(r.score).toBe(100)
  })

  it('weights components correctly (coverage-only)', () => {
    const r = computeDataHealthScore({
      coveragePct: 1,
      evidencePct: 0,
      agreementAvg: 0,
      openDisputes: 0,
      attributeRows: 1000,
    })
    // 0.30 * 1 + 0.15 * 1 = 0.45 → 45
    expect(r.score).toBe(45)
  })

  it('clamps inputs above 1 and below 0', () => {
    const r = computeDataHealthScore({
      coveragePct: 1.5,
      evidencePct: -0.2,
      agreementAvg: 99,
      openDisputes: 0,
      attributeRows: 1000,
    })
    // coverage→1, evidence→0, agreement→1, disputeHealth→1
    // 0.30 + 0.25 + 0.15 = 0.70 → 70
    expect(r.score).toBe(70)
  })

  it('penalises high open-dispute density', () => {
    const high = computeDataHealthScore({
      coveragePct: 1,
      evidencePct: 1,
      agreementAvg: 1,
      openDisputes: 1000,
      attributeRows: 1000,
    })
    // disputeHealth → 0; weighted = 0.30+0.30+0.25 = 0.85 → 85
    expect(high.score).toBe(85)

    const low = computeDataHealthScore({
      coveragePct: 1,
      evidencePct: 1,
      agreementAvg: 1,
      openDisputes: 10,
      attributeRows: 1000,
    })
    // density 0.01 → disputeHealth 0.99; weighted 0.85 + 0.15*0.99 = 0.9985 → 99.9
    expect(low.score).toBe(99.9)
  })

  it('handles NaN / Infinity defensively', () => {
    const r = computeDataHealthScore({
      coveragePct: Number.NaN,
      evidencePct: Number.POSITIVE_INFINITY,
      agreementAvg: Number.NEGATIVE_INFINITY,
      openDisputes: 0,
      attributeRows: 100,
    })
    // All non-finite inputs collapse to 0; only disputeHealth (1) remains
    // weighted = 0.15 × 1 = 0.15 → 15
    expect(r.score).toBe(15)
  })

  it('exposes the weight + component breakdown', () => {
    const r = computeDataHealthScore({
      coveragePct: 0.5,
      evidencePct: 0.5,
      agreementAvg: 0.5,
      openDisputes: 0,
      attributeRows: 1000,
    })
    expect(r.weights).toEqual({ coverage: 0.30, evidence: 0.30, agreement: 0.25, disputeHealth: 0.15 })
    expect(r.components.coverage).toBe(0.5)
    expect(r.components.disputeHealth).toBe(1)
  })
})
