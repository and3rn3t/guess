import { describe, it, expect } from 'vitest'
import {
  generateReasoning,
  getBestGuess,
  detectContradictions,
  shouldMakeGuess,
} from './guess-readiness.js'
import type { GameCharacter, GameQuestion, GameAnswer } from './types.js'

const q: GameQuestion = { attribute: 'fast', category: 'physical' }

const charA: GameCharacter = { id: 'a', name: 'Sonic', attributes: { fast: true } }
const charB: GameCharacter = { id: 'b', name: 'Sloth', attributes: { fast: false } }
const charC: GameCharacter = { id: 'c', name: 'Cheetah', attributes: { fast: true } }

// ── generateReasoning ──────────────────────────────────────────────────────

describe('generateReasoning', () => {
  it('returns remaining count matching characters length', () => {
    const r = generateReasoning(q, [charA, charB, charC], [])
    expect(r.remaining).toBe(3)
  })

  it('confidence is between 0 and 100', () => {
    const r = generateReasoning(q, [charA, charB], [])
    expect(r.confidence).toBeGreaterThanOrEqual(0)
    expect(r.confidence).toBeLessThanOrEqual(100)
  })

  it('topCandidates contains at most 5 entries', () => {
    const chars = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: `Char${i}`,
      attributes: { fast: i % 2 === 0 },
    }))
    const r = generateReasoning(q, chars, [])
    expect(r.topCandidates.length).toBeLessThanOrEqual(5)
  })

  it('why and impact are non-empty strings', () => {
    const r = generateReasoning(q, [charA, charB], [])
    expect(typeof r.why).toBe('string')
    expect(r.why.length).toBeGreaterThan(0)
    expect(typeof r.impact).toBe('string')
    expect(r.impact.length).toBeGreaterThan(0)
  })
})

// ── getBestGuess ────────────────────────────────────────────────────────────

describe('getBestGuess', () => {
  it('returns null for empty characters', () => {
    expect(getBestGuess([], [])).toBeNull()
  })

  it('returns the highest-probability character', () => {
    const answers: GameAnswer[] = [{ questionId: 'fast', value: 'yes' }]
    const best = getBestGuess([charA, charB], answers)
    expect(best?.id).toBe('a') // charA has fast=true, matches yes
  })
})

// ── detectContradictions ───────────────────────────────────────────────────

describe('detectContradictions', () => {
  it('returns no contradiction for empty answers', () => {
    const result = detectContradictions([charA, charB], [])
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(2)
  })

  it('detects contradiction when all characters are eliminated', () => {
    // Use a scenario guaranteed to exceed MAX_MISMATCHES=2
    const strictChars: GameCharacter[] = [
      { id: 'x', name: 'X', attributes: { a: true, b: true, c: true } },
    ]
    const strictAnswers: GameAnswer[] = [
      { questionId: 'a', value: 'no' },
      { questionId: 'b', value: 'no' },
      { questionId: 'c', value: 'no' },
    ]
    const r = detectContradictions(strictChars, strictAnswers)
    expect(r.hasContradiction).toBe(true)
    expect(r.remainingCount).toBe(0)
  })

  it('tolerates up to 2 mismatches (enrichment noise tolerance)', () => {
    // charA has fast=true but we answer 'no' twice and 'yes' once → 2 mismatches → still included
    const noisyChar: GameCharacter = { id: 'n', name: 'Noisy', attributes: { a: true, b: true, c: false } }
    const answers: GameAnswer[] = [
      { questionId: 'a', value: 'no' }, // mismatch 1
      { questionId: 'b', value: 'no' }, // mismatch 2
    ]
    const r = detectContradictions([noisyChar], answers)
    expect(r.hasContradiction).toBe(false) // 2 mismatches → still within tolerance
    expect(r.remainingCount).toBe(1)
  })
})

// ── shouldMakeGuess ─────────────────────────────────────────────────────────

describe('shouldMakeGuess', () => {
  it('forces a guess when max questions reached', () => {
    expect(shouldMakeGuess([charA, charB], [], 15, 15)).toBe(true)
  })

  it('guesses when singleton remains', () => {
    const answers: GameAnswer[] = [{ questionId: 'fast', value: 'yes' }]
    // charB has fast=false → contradicts → near-zero probability → singleton charA
    expect(shouldMakeGuess([charA, charB], answers, 5, 15)).toBe(true)
  })
})
