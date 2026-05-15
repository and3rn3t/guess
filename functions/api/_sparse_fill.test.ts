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

  // ── coverage fallback ─────────────────────────────────────────────────────

  it('falls back to coverage order when popularity candidates are exhausted', () => {
    // 'popular' has been played; 'sparse' and 'dense' have not.
    // sparse has 1 stored key; dense has 3 stored keys.
    // After 'popular' consumes its budget share, fallback should pick 'sparse'
    // before 'dense' because it has fewer stored keys.
    const out = selectGaps(
      [
        cand('popular', 'anime', 0.9, []),
        cand('sparse', 'anime', 0, ['hasBlueHair']),
        cand('dense', 'anime', 0, ['hasBlueHair', 'wearsGlasses', 'isFemale']),
      ],
      ATTRS,
      { totalGapBudget: 100 }
    )
    const ids = out.map((g) => g.characterId)
    expect(ids[0]).toBe('popular')
    expect(ids.indexOf('sparse')).toBeLessThan(ids.indexOf('dense'))
  })

  it('coverage fallback breaks ties by id (alphabetical)', () => {
    // Both cold chars have identical coverage (0 stored keys).
    // Tie should break by id: 'alpha' before 'zeta'.
    const out = selectGaps(
      [
        cand('zeta', 'anime', 0, []),
        cand('alpha', 'anime', 0, []),
      ],
      ATTRS,
      { totalGapBudget: 100 }
    )
    expect(out.map((g) => g.characterId)).toEqual(['alpha', 'zeta'])
  })

  it('coverage fallback respects maxGapsPerCharacter', () => {
    const out = selectGaps(
      [cand('cold', 'anime', 0, [])],
      ATTRS,
      { totalGapBudget: 100, maxGapsPerCharacter: 2 }
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.missingKeys).toHaveLength(2)
  })

  it('coverage fallback respects totalGapBudget', () => {
    const out = selectGaps(
      [
        cand('a', 'anime', 0, []),
        cand('b', 'anime', 0, []),
        cand('c', 'anime', 0, []),
      ],
      ATTRS,
      { totalGapBudget: 5 }
    )
    const total = out.reduce((n, g) => n + g.missingKeys.length, 0)
    expect(total).toBe(5)
  })

  it('does not fall back when fallbackMode is none', () => {
    const out = selectGaps(
      [
        cand('popular', 'anime', 0.9, ['hasBlueHair', 'wearsGlasses', 'isFemale', 'canFly']), // no gaps
        cand('cold', 'anime', 0, []),
      ],
      ATTRS,
      { totalGapBudget: 100, fallbackMode: 'none' }
    )
    // 'popular' has no gaps; 'cold' has popularity=0 and fallback is off
    expect(out).toEqual([])
  })

  it('popularity candidates with gaps are still selected before cold ones', () => {
    const out = selectGaps(
      [
        cand('cold-sparse', 'anime', 0, []),
        cand('popular-sparse', 'anime', 0.5, []),
      ],
      ATTRS,
      { totalGapBudget: 100 }
    )
    const ids = out.map((g) => g.characterId)
    expect(ids[0]).toBe('popular-sparse')
    expect(ids[1]).toBe('cold-sparse')
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
