import { describe, expect, it } from 'vitest'

import { selectRiskTierSample, type RiskTierCandidate } from './_risk_tier'

function makeCandidate(index: number, overrides: Partial<RiskTierCandidate> = {}): RiskTierCandidate {
  return {
    id: `char-${String(index).padStart(2, '0')}`,
    name: `Character ${index}`,
    category: 'anime',
    popularity: 1 - index * 0.01,
    plays30d: Math.max(0, 40 - index),
    openDisputes: index % 5 === 0 ? 1 : 0,
    agreementAvg: Math.max(0.4, 0.95 - index * 0.01),
    lastValidatedAt: 1_710_000_000 + index * 60,
    ...overrides,
  }
}

describe('selectRiskTierSample', () => {
  it('assigns high-risk rows into tier1 and applies limit', () => {
    const rows: RiskTierCandidate[] = Array.from({ length: 20 }, (_, index) => makeCandidate(index + 1))
    rows.push(
      makeCandidate(100, {
        id: 'top-risk',
        plays30d: 10_000,
        openDisputes: 4,
        agreementAvg: 0.2,
        lastValidatedAt: 1_600_000_000,
      }),
    )

    const selection = selectRiskTierSample(rows, 'tier1', { limit: 3, nowMs: 1_900_000_000_000 })

    expect(selection.selected).toHaveLength(3)
    expect(selection.selected[0]?.id).toBe('top-risk')
    expect(selection.selected.every((row) => row.tier === 'tier1')).toBe(true)
    expect(selection.coverage.selectedCount).toBe(3)
    expect(selection.coverage.totalCandidates).toBe(rows.length)
  })

  it('splits candidates into all three tiers deterministically', () => {
    const rows: RiskTierCandidate[] = Array.from({ length: 30 }, (_, index) => makeCandidate(index + 1))

    const t1 = selectRiskTierSample(rows, 'tier1', { nowMs: 1_900_000_000_000 })
    const t2 = selectRiskTierSample(rows, 'tier2', { nowMs: 1_900_000_000_000 })
    const t3 = selectRiskTierSample(rows, 'tier3', { nowMs: 1_900_000_000_000 })

    expect(t1.coverage.tierCandidates).toBeGreaterThan(0)
    expect(t2.coverage.tierCandidates).toBeGreaterThan(0)
    expect(t3.coverage.tierCandidates).toBeGreaterThan(0)

    const all = new Set([
      ...t1.allRanked.map((row) => `${row.id}:${row.tier}`),
      ...t2.allRanked.map((row) => `${row.id}:${row.tier}`),
      ...t3.allRanked.map((row) => `${row.id}:${row.tier}`),
    ])
    expect(all.size).toBe(rows.length)
  })

  it('treats missing lastValidatedAt as stale and prioritizes stale rows', () => {
    const fresh = makeCandidate(1, { id: 'fresh', plays30d: 10, agreementAvg: 0.7, lastValidatedAt: 1_899_000_000_000 })
    const stale = makeCandidate(2, { id: 'stale', plays30d: 10, agreementAvg: 0.7, lastValidatedAt: null })

    const selection = selectRiskTierSample([fresh, stale], 'tier1', { limit: 2, nowMs: 1_900_000_000_000 })
    expect(selection.selected[0]?.id).toBe('stale')
    expect(selection.selected[0]?.staleDays).toBeGreaterThan(selection.selected[1]?.staleDays ?? 0)
  })
})
