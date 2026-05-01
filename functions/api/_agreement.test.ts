import { describe, expect, it } from 'vitest'
import {
  computeAgreementScore,
  CONTESTED_THRESHOLD,
  isContested,
  type AgreementSignal,
} from './_agreement'

describe('computeAgreementScore', () => {
  it('returns null score when no signals are provided', () => {
    expect(computeAgreementScore([])).toEqual({ score: null, signalCount: 0 })
  })

  it('returns 1.0 when every signal agrees', () => {
    const signals: AgreementSignal[] = [
      { source: 'reveal', agrees: true },
      { source: 'reveal', agrees: true },
      { source: 'dispute-dismissed', agrees: true },
    ]
    const result = computeAgreementScore(signals)
    expect(result.score).toBe(1)
    expect(result.signalCount).toBe(3)
  })

  it('returns 0.0 when every signal disagrees', () => {
    const signals: AgreementSignal[] = [
      { source: 'reveal', agrees: false },
      { source: 'dispute-open', agrees: false },
    ]
    expect(computeAgreementScore(signals).score).toBe(0)
  })

  it('weights dispute-open higher than a single reveal', () => {
    // 1 reveal agrees, 1 open dispute disagrees.
    // Default weights: reveal=1, dispute-open=2 → 1 / (1 + 2) = 0.333
    const signals: AgreementSignal[] = [
      { source: 'reveal', agrees: true },
      { source: 'dispute-open', agrees: false },
    ]
    expect(computeAgreementScore(signals).score).toBe(0.333)
  })

  it('honours weight overrides', () => {
    const signals: AgreementSignal[] = [
      { source: 'reveal', agrees: true },
      { source: 'reveal', agrees: false },
    ]
    expect(
      computeAgreementScore(signals, { reveal: 2 }).score
    ).toBe(0.5)
  })

  it('skips zero-weight sources without inflating signalCount denominator', () => {
    const signals: AgreementSignal[] = [
      { source: 'reveal', agrees: true },
      { source: 'community-vote', agrees: false },
    ]
    // community-vote weight = 0 → only the reveal counts → 1.0
    expect(
      computeAgreementScore(signals, { 'community-vote': 0 }).score
    ).toBe(1)
  })

  it('returns null score when every weight collapses to zero', () => {
    const signals: AgreementSignal[] = [
      { source: 'reveal', agrees: true },
    ]
    expect(
      computeAgreementScore(signals, { reveal: 0 })
    ).toEqual({ score: null, signalCount: 1 })
  })
})

describe('isContested', () => {
  it('treats low-signal rows as not contested even with a low score', () => {
    expect(
      isContested({ score: 0.2, signalCount: 2 })
    ).toBe(false)
  })

  it('flags rows with >=3 signals and score under threshold', () => {
    expect(
      isContested({ score: 0.4, signalCount: 5 })
    ).toBe(true)
  })

  it('does not flag rows at the threshold', () => {
    expect(
      isContested({ score: CONTESTED_THRESHOLD, signalCount: 10 })
    ).toBe(false)
  })

  it('does not flag null scores', () => {
    expect(isContested({ score: null, signalCount: 0 })).toBe(false)
  })
})
