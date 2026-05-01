import { describe, expect, it } from 'vitest'

import {
  groupGapsByCategory,
  selectGaps,
  unionMissingKeys,
  type CharacterCandidate,
} from './_sparse_fill'

const ATTRS = new Map<string, readonly string[]>([
  ['anime', ['hasBlueHair', 'wearsGlasses', 'isFemale', 'canFly']],
  ['marvel', ['wearsCape', 'hasBeard', 'isFemale']],
])

function cand(
  id: string,
  category: string,
  popularity: number,
  storedKeys: string[] = []
): CharacterCandidate {
  return { id, category, popularity, storedKeys: new Set(storedKeys) }
}

describe('selectGaps', () => {
  it('returns empty when budget is zero', () => {
    const out = selectGaps([cand('a', 'anime', 1)], ATTRS, { totalGapBudget: 0 })
    expect(out).toEqual([])
  })

  it('ranks by popularity DESC, ties broken by id', () => {
    const out = selectGaps(
      [cand('zeta', 'anime', 0.5), cand('alpha', 'anime', 0.5), cand('top', 'anime', 0.9)],
      ATTRS,
      { totalGapBudget: 100 }
    )
    expect(out.map((g) => g.characterId)).toEqual(['top', 'alpha', 'zeta'])
  })

  it('drops characters with no gaps (all attrs already stored)', () => {
    const out = selectGaps(
      [cand('full', 'anime', 1, ['hasBlueHair', 'wearsGlasses', 'isFemale', 'canFly'])],
      ATTRS,
      { totalGapBudget: 100 }
    )
    expect(out).toEqual([])
  })

  it('drops characters whose category has no attribute set', () => {
    const out = selectGaps([cand('mystery', 'unknown-cat', 1)], ATTRS, {
      totalGapBudget: 100,
    })
    expect(out).toEqual([])
  })

  it('respects totalGapBudget across characters', () => {
    const out = selectGaps(
      [cand('a', 'anime', 1), cand('b', 'anime', 0.9), cand('c', 'anime', 0.8)],
      ATTRS,
      { totalGapBudget: 5 }
    )
    const total = out.reduce((n, g) => n + g.missingKeys.length, 0)
    expect(total).toBe(5)
  })

  it('caps per-character gaps with maxGapsPerCharacter', () => {
    const out = selectGaps([cand('a', 'anime', 1)], ATTRS, {
      totalGapBudget: 100,
      maxGapsPerCharacter: 2,
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.missingKeys).toHaveLength(2)
  })

  it('skips characters below minPopularity', () => {
    const out = selectGaps(
      [cand('hot', 'anime', 0.9), cand('cold', 'anime', 0.1)],
      ATTRS,
      { totalGapBudget: 100, minPopularity: 0.5 }
    )
    expect(out.map((g) => g.characterId)).toEqual(['hot'])
  })

  it('omits already-stored keys from missingKeys', () => {
    const out = selectGaps([cand('a', 'anime', 1, ['hasBlueHair', 'canFly'])], ATTRS, {
      totalGapBudget: 100,
    })
    expect(out[0]!.missingKeys.sort()).toEqual(['isFemale', 'wearsGlasses'])
  })
})

describe('groupGapsByCategory', () => {
  it('buckets per category with stable order', () => {
    const a = { characterId: 'x', category: 'anime', popularity: 1, missingKeys: ['k1'] }
    const b = { characterId: 'y', category: 'marvel', popularity: 1, missingKeys: ['k2'] }
    const c = { characterId: 'z', category: 'anime', popularity: 0.5, missingKeys: ['k3'] }
    const grouped = groupGapsByCategory([a, b, c])
    expect(grouped.get('anime')).toEqual([a, c])
    expect(grouped.get('marvel')).toEqual([b])
  })
})

describe('unionMissingKeys', () => {
  it('returns sorted unique union', () => {
    const out = unionMissingKeys([
      { characterId: 'a', category: 'x', popularity: 1, missingKeys: ['c', 'a'] },
      { characterId: 'b', category: 'x', popularity: 1, missingKeys: ['b', 'a'] },
    ])
    expect(out).toEqual(['a', 'b', 'c'])
  })
})
