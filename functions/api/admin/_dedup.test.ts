import { describe, expect, it } from 'vitest'
import {
  canonicalPairKey,
  cosineSimilarity,
  deserializeEmbedding,
  findDuplicatePairs,
  serializeEmbedding,
  shortTextHash,
  type QuestionVector,
} from './_dedup'

const vec = (...nums: number[]): Float32Array => new Float32Array(nums)

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity(vec(1, 2, 3), vec(1, 2, 3))).toBeCloseTo(1, 6)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity(vec(1, 2, 3), vec(-1, -2, -3))).toBeCloseTo(-1, 6)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(vec(1, 0, 0), vec(0, 1, 0))).toBeCloseTo(0, 6)
  })

  it('returns 0 for a zero-magnitude input rather than NaN', () => {
    expect(cosineSimilarity(vec(0, 0, 0), vec(1, 1, 1))).toBe(0)
  })

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity(vec(1, 2), vec(1, 2, 3))).toThrow(/length mismatch/)
  })
})

describe('serializeEmbedding / deserializeEmbedding', () => {
  it('round-trips a Float32Array losslessly', () => {
    const original = vec(0.1, -0.5, 0.999, -1.0, 42.5)
    const blob = serializeEmbedding(original)
    const decoded = deserializeEmbedding(blob)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('handles unaligned Uint8Array input (D1 harness path)', () => {
    const original = vec(1.5, 2.5, 3.5)
    // Wrap in a larger buffer with a non-zero offset to force misalignment.
    const padded = new Uint8Array(original.byteLength + 3)
    padded.set(new Uint8Array(original.buffer), 3)
    const slice = padded.subarray(3)
    const decoded = deserializeEmbedding(slice)
    expect(Array.from(decoded)).toEqual([1.5, 2.5, 3.5])
  })
})

describe('canonicalPairKey', () => {
  it('orders the two keys lexicographically', () => {
    expect(canonicalPairKey('isVillain', 'isEvil')).toBe('isEvil::isVillain')
    expect(canonicalPairKey('isEvil', 'isVillain')).toBe('isEvil::isVillain')
  })
})

describe('shortTextHash', () => {
  it('returns the same hex for identical strings', () => {
    expect(shortTextHash('Is this character a hero?')).toBe(shortTextHash('Is this character a hero?'))
  })

  it('returns different hex for different strings', () => {
    expect(shortTextHash('hero')).not.toBe(shortTextHash('villain'))
  })

  it('always returns 8 hex chars', () => {
    expect(shortTextHash('')).toHaveLength(8)
    expect(shortTextHash('a')).toHaveLength(8)
    expect(shortTextHash('a much longer string than the rest')).toHaveLength(8)
  })
})

describe('findDuplicatePairs', () => {
  const v1 = vec(1, 0, 0)
  const v2 = vec(0.99, 0.05, 0)        // ~very similar to v1
  const v3 = vec(0, 1, 0)              // orthogonal
  const v4 = vec(0.95, 0.05, 0.05)     // also similar to v1 but a bit less

  const vectors: QuestionVector[] = [
    { attributeKey: 'isHero', text: 'Is this character a hero?', embedding: v1 },
    { attributeKey: 'isProtagonist', text: 'Is this character a protagonist?', embedding: v2 },
    { attributeKey: 'hasHat', text: 'Does this character wear a hat?', embedding: v3 },
    { attributeKey: 'isMainCharacter', text: 'Is this the main character?', embedding: v4 },
  ]

  it('flags pairs above the threshold sorted by descending similarity', () => {
    const pairs = findDuplicatePairs(vectors, 0.9)
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs[0]!.similarity).toBeGreaterThan(pairs[pairs.length - 1]!.similarity - 0.0001)
    // Highest pair should involve isHero/isProtagonist.
    expect(pairs[0]!.pairKey).toBe('isHero::isProtagonist')
  })

  it('canonicalises pair keys so order is stable', () => {
    const pairs = findDuplicatePairs(vectors, 0.9)
    for (const p of pairs) {
      expect(p.attributeKeyA < p.attributeKeyB).toBe(true)
    }
  })

  it('skips pairs in the dismissed set', () => {
    const dismissed = new Set(['isHero::isProtagonist'])
    const pairs = findDuplicatePairs(vectors, 0.9, dismissed)
    expect(pairs.find((p) => p.pairKey === 'isHero::isProtagonist')).toBeUndefined()
  })

  it('returns an empty array when the threshold is too high', () => {
    expect(findDuplicatePairs(vectors, 0.999999)).toEqual([])
  })

  it('handles zero or one vector without crashing', () => {
    expect(findDuplicatePairs([], 0.5)).toEqual([])
    expect(findDuplicatePairs([vectors[0]!], 0.5)).toEqual([])
  })
})
