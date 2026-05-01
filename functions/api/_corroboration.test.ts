import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DISAGREEMENT_THRESHOLD,
  DEFAULT_MIN_VOTES,
  disagreementToConfidence,
  evaluateCorroboration,
  type PlayerVote,
} from './_corroboration'

function votes(yes: number, no: number): PlayerVote[] {
  const out: PlayerVote[] = []
  for (let i = 0; i < yes; i++) out.push({ value: 1 })
  for (let i = 0; i < no; i++) out.push({ value: 0 })
  return out
}

describe('evaluateCorroboration', () => {
  it('returns shouldDispute=false below the volume threshold', () => {
    // 19 votes, all disagreeing — under min volume → no dispute
    const r = evaluateCorroboration(votes(0, 19), 1)
    expect(r.totalVotes).toBe(19)
    expect(r.disagreementRate).toBe(1)
    expect(r.shouldDispute).toBe(false)
    expect(r.suggestedValue).toBeNull()
    expect(r.reason).toContain('need ≥20 votes')
  })

  it('returns shouldDispute=false at exactly the disagreement threshold (strict greater-than)', () => {
    // 20 votes, exactly 70% disagreement → not strictly greater → no dispute
    const r = evaluateCorroboration(votes(6, 14), 1) // 14/20 = 0.7
    expect(r.totalVotes).toBe(20)
    expect(r.disagreementRate).toBe(0.7)
    expect(r.shouldDispute).toBe(false)
  })

  it('files a dispute when 20+ votes and >70% disagree with stored=1', () => {
    // 20 votes, 16 say "no" while stored=1 → 80% disagreement
    const r = evaluateCorroboration(votes(4, 16), 1)
    expect(r.totalVotes).toBe(20)
    expect(r.disagreementRate).toBe(0.8)
    expect(r.shouldDispute).toBe(true)
    expect(r.suggestedValue).toBe(0)
    expect(r.reason).toContain('16/20')
    expect(r.reason).toContain('80.0%')
    expect(r.reason).toContain('suggested=0')
  })

  it('files a dispute when 20+ votes and >70% disagree with stored=0', () => {
    const r = evaluateCorroboration(votes(18, 4), 0) // 18/22 ≈ 0.818 yes
    expect(r.shouldDispute).toBe(true)
    expect(r.suggestedValue).toBe(1)
  })

  it('handles a perfect tie at high volume by emitting suggestedValue=null', () => {
    // 25 yes / 25 no — 50% disagreement regardless of stored, but threshold is 70%
    const r = evaluateCorroboration(votes(25, 25), 1)
    expect(r.shouldDispute).toBe(false)
    expect(r.suggestedValue).toBeNull()
  })

  it('honours custom thresholds', () => {
    // Lower bar: 10 votes, 60% disagree → would dispute
    const r = evaluateCorroboration(votes(4, 6), 1, {
      minVotes: 10,
      disagreementThreshold: 0.5,
    })
    expect(r.shouldDispute).toBe(true)
    expect(r.suggestedValue).toBe(0)
  })

  it('treats empty vote arrays as not disputable', () => {
    const r = evaluateCorroboration([], 1)
    expect(r.totalVotes).toBe(0)
    expect(r.disagreementRate).toBe(0)
    expect(r.shouldDispute).toBe(false)
    expect(r.suggestedValue).toBeNull()
  })

  it('exposes sane default constants', () => {
    expect(DEFAULT_MIN_VOTES).toBe(20)
    expect(DEFAULT_DISAGREEMENT_THRESHOLD).toBe(0.7)
  })
})

describe('disagreementToConfidence', () => {
  it('returns 0.7 floor at or below threshold', () => {
    expect(disagreementToConfidence(0.7)).toBe(0.7)
    expect(disagreementToConfidence(0.5)).toBe(0.7)
    expect(disagreementToConfidence(0)).toBe(0.7)
  })

  it('returns 0.99 ceiling at 100% disagreement', () => {
    expect(disagreementToConfidence(1)).toBe(0.99)
  })

  it('scales linearly between threshold and 1', () => {
    // Halfway between 0.7 and 1.0 (i.e. 0.85) → 0.7 + 0.29*0.5 = 0.845
    expect(disagreementToConfidence(0.85)).toBe(0.845)
  })

  it('respects a custom threshold', () => {
    // threshold=0.5; rate=0.75 → halfway → 0.7 + 0.29*0.5 = 0.845
    expect(disagreementToConfidence(0.75, 0.5)).toBe(0.845)
  })
})
