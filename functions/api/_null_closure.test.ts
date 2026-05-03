import { describe, expect, it } from 'vitest'

import { buildNullClosureQueue, type NullClosurePairInput } from './_null_closure'

function pair(overrides: Partial<NullClosurePairInput> = {}): NullClosurePairInput {
  return {
    characterId: 'char-1',
    characterName: 'Alpha',
    category: 'anime',
    attributeKey: 'personality',
    popularity: 0.8,
    selectorImpact: 0.7,
    confidenceGap: 0.4,
    stalenessDays: 45,
    hasQuestion: true,
    ...overrides,
  }
}

describe('buildNullClosureQueue', () => {
  it('ranks higher score first using the multiplicative DQ.33 formula', () => {
    const out = buildNullClosureQueue([
      pair({ characterId: 'low', characterName: 'Beta', popularity: 0.4 }),
      pair({ characterId: 'high', characterName: 'Alpha', popularity: 0.9 }),
    ])

    expect(out.map((item) => item.characterId)).toEqual(['high', 'low'])
    expect(out[0].score).toBeGreaterThan(out[1].score)
  })

  it('routes low-confidence or questionless work to manual lane', () => {
    const out = buildNullClosureQueue([
      pair({ characterId: 'auto', hasQuestion: true, confidenceGap: 0.8, stalenessDays: 90 }),
      pair({ characterId: 'manual-no-question', hasQuestion: false, confidenceGap: 0.8, stalenessDays: 90 }),
      pair({ characterId: 'manual-low-score', hasQuestion: true, confidenceGap: 0.05, stalenessDays: 5 }),
    ])

    expect(out.find((item) => item.characterId === 'auto')?.lane).toBe('automation')
    expect(out.find((item) => item.characterId === 'manual-no-question')?.lane).toBe('manual')
    expect(out.find((item) => item.characterId === 'manual-low-score')?.lane).toBe('manual')
  })

  it('uses deterministic tie-breaks after score equality', () => {
    const out = buildNullClosureQueue([
      pair({ characterId: 'c2', characterName: 'Beta', attributeKey: 'zeta', confidenceGap: 0.5 }),
      pair({ characterId: 'c1', characterName: 'Alpha', attributeKey: 'alpha', confidenceGap: 0.5 }),
    ])

    expect(out.map((item) => item.characterId)).toEqual(['c1', 'c2'])
  })

  it('clamps invalid numeric inputs and drops zero-score pairs', () => {
    const out = buildNullClosureQueue([
      pair({ characterId: 'drop', popularity: Number.NaN }),
      pair({ characterId: 'keep', popularity: 2, selectorImpact: 2, confidenceGap: 2, stalenessDays: 180 }),
    ])

    expect(out).toHaveLength(1)
    expect(out[0].characterId).toBe('keep')
    expect(out[0].components).toEqual({
      popularity: 1,
      selectorImpact: 1,
      confidenceGap: 1,
      staleness: 1,
    })
  })
})