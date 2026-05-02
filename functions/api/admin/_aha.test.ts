import { describe, it, expect } from 'vitest'
import { computeAhaMoment, buildAhaMomentsMap } from './_aha'

// ── computeAhaMoment ─────────────────────────────────────────────────────────

describe('computeAhaMoment', () => {
  it('returns null for empty history', () => {
    expect(computeAhaMoment([])).toBeNull()
  })

  it('returns null for 1-step history', () => {
    expect(computeAhaMoment([0.2])).toBeNull()
  })

  it('returns null for 2-step history', () => {
    expect(computeAhaMoment([0.2, 0.4])).toBeNull()
  })

  it('detects jump at index 1 (first jump)', () => {
    // posteriors: 0.1 → 0.8 → 0.85
    // jumps: idx1=0.7, idx2=0.05 → aha at 1
    const result = computeAhaMoment([0.1, 0.8, 0.85])
    expect(result).not.toBeNull()
    expect(result!.index).toBe(1)
    expect(result!.jump).toBeCloseTo(0.7, 3)
  })

  it('detects jump at a later step', () => {
    // posteriors: 0.2 → 0.25 → 0.3 → 0.9
    // jumps: 0.05, 0.05, 0.6 → aha at 3
    const result = computeAhaMoment([0.2, 0.25, 0.3, 0.9])
    expect(result).not.toBeNull()
    expect(result!.index).toBe(3)
    expect(result!.jump).toBeCloseTo(0.6, 3)
  })

  it('returns null when all jumps are non-positive (monotone decreasing)', () => {
    const result = computeAhaMoment([0.9, 0.5, 0.3, 0.2])
    expect(result).toBeNull()
  })

  it('picks first max when two equal jumps exist', () => {
    // jumps: idx1=0.4, idx2=0.4 → should pick idx 1 (first)
    const result = computeAhaMoment([0.1, 0.5, 0.9, 1.0])
    expect(result).not.toBeNull()
    // 0.5-0.1=0.4, 0.9-0.5=0.4, 1.0-0.9=0.1 → first max idx 1
    expect(result!.index).toBe(1)
  })

  it('returns jump rounded to 4 decimal places', () => {
    const result = computeAhaMoment([0, 0.123456789, 0.2])
    expect(result).not.toBeNull()
    expect(result!.jump.toString().split('.')[1]?.length).toBeLessThanOrEqual(4)
  })

  it('handles flat then spike', () => {
    const result = computeAhaMoment([0.05, 0.05, 0.05, 0.05, 0.95])
    expect(result!.index).toBe(4)
    expect(result!.jump).toBeCloseTo(0.9, 3)
  })
})

// ── buildAhaMomentsMap ───────────────────────────────────────────────────────

describe('buildAhaMomentsMap', () => {
  it('returns empty array for empty input', () => {
    expect(buildAhaMomentsMap([])).toEqual([])
  })

  it('ignores rows with null aha_attr or aha_jump', () => {
    const rows = [
      { aha_attr: null, aha_jump: 0.5 },
      { aha_attr: 'isMale', aha_jump: null },
    ]
    expect(buildAhaMomentsMap(rows)).toEqual([])
  })

  it('groups by attribute and counts correctly', () => {
    const rows = [
      { aha_attr: 'isMale', aha_jump: 0.4 },
      { aha_attr: 'isMale', aha_jump: 0.6 },
      { aha_attr: 'isHuman', aha_jump: 0.3 },
    ]
    const result = buildAhaMomentsMap(rows)
    expect(result).toHaveLength(2)
    const isMale = result.find((r) => r.attribute === 'isMale')!
    expect(isMale.count).toBe(2)
    expect(isMale.medianJump).toBeCloseTo(0.5, 3)
    expect(isMale.avgJump).toBeCloseTo(0.5, 3)
  })

  it('sorts by count descending', () => {
    const rows = [
      { aha_attr: 'isHuman', aha_jump: 0.3 },
      { aha_attr: 'isMale', aha_jump: 0.4 },
      { aha_attr: 'isMale', aha_jump: 0.6 },
      { aha_attr: 'isMale', aha_jump: 0.5 },
    ]
    const result = buildAhaMomentsMap(rows)
    expect(result[0].attribute).toBe('isMale')
    expect(result[1].attribute).toBe('isHuman')
  })

  it('computes median correctly for odd-length arrays', () => {
    const rows = [
      { aha_attr: 'isVillain', aha_jump: 0.1 },
      { aha_attr: 'isVillain', aha_jump: 0.5 },
      { aha_attr: 'isVillain', aha_jump: 0.9 },
    ]
    const result = buildAhaMomentsMap(rows)
    expect(result[0].medianJump).toBeCloseTo(0.5, 3)
  })

  it('computes median correctly for even-length arrays', () => {
    const rows = [
      { aha_attr: 'isHero', aha_jump: 0.2 },
      { aha_attr: 'isHero', aha_jump: 0.4 },
      { aha_attr: 'isHero', aha_jump: 0.6 },
      { aha_attr: 'isHero', aha_jump: 0.8 },
    ]
    const result = buildAhaMomentsMap(rows)
    expect(result[0].medianJump).toBeCloseTo(0.5, 3)
  })
})
