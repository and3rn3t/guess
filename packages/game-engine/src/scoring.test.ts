import { describe, it, expect } from 'vitest'
import { scoreForAnswer, calculateProbabilities } from './scoring.js'
import {
  SCORE_MATCH,
  SCORE_MISMATCH,
  SCORE_UNKNOWN,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
} from './constants.js'
import type { GameCharacter, GameAnswer } from './types.js'

describe('scoreForAnswer', () => {
  it('returns SCORE_MATCH for yes/true', () => {
    expect(scoreForAnswer('yes', true)).toBe(SCORE_MATCH)
  })

  it('returns SCORE_MISMATCH for yes/false', () => {
    expect(scoreForAnswer('yes', false)).toBe(SCORE_MISMATCH)
  })

  it('returns SCORE_UNKNOWN for yes/null', () => {
    expect(scoreForAnswer('yes', null)).toBe(SCORE_UNKNOWN)
  })

  it('returns SCORE_MATCH for no/false', () => {
    expect(scoreForAnswer('no', false)).toBe(SCORE_MATCH)
  })

  it('returns SCORE_MISMATCH for no/true', () => {
    expect(scoreForAnswer('no', true)).toBe(SCORE_MISMATCH)
  })

  it('returns SCORE_MAYBE for maybe/true', () => {
    expect(scoreForAnswer('maybe', true)).toBe(SCORE_MAYBE)
  })

  it('returns SCORE_MAYBE_MISS for maybe/false', () => {
    expect(scoreForAnswer('maybe', false)).toBe(SCORE_MAYBE_MISS)
  })

  it('returns 1 for unknown answer (no effect)', () => {
    expect(scoreForAnswer('unknown', true)).toBe(1)
    expect(scoreForAnswer('unknown', false)).toBe(1)
  })

  it('uses custom weight overrides', () => {
    const result = scoreForAnswer('yes', true, SCORE_UNKNOWN, { match: 0.5 })
    expect(result).toBe(0.5)
  })

  it('uses custom effectiveUnknown for null attributes', () => {
    expect(scoreForAnswer('yes', null, 0.2)).toBe(0.2)
  })
})

// ── calculateProbabilities ─────────────────────────────────────────────────

const charA: GameCharacter = { id: 'a', name: 'A', attributes: { fast: true, strong: false } }
const charB: GameCharacter = { id: 'b', name: 'B', attributes: { fast: false, strong: true } }
const charC: GameCharacter = { id: 'c', name: 'C', attributes: { fast: true, strong: true } }

describe('calculateProbabilities', () => {
  it('assigns equal priors when no answers given', () => {
    const probs = calculateProbabilities([charA, charB], [])
    expect(probs.get('a')).toBeCloseTo(0.5)
    expect(probs.get('b')).toBeCloseTo(0.5)
  })

  it('boosts character matching a yes answer', () => {
    const answers: GameAnswer[] = [{ questionId: 'fast', value: 'yes' }]
    const probs = calculateProbabilities([charA, charB], answers)
    expect(probs.get('a')).toBeGreaterThan(probs.get('b')!)
  })

  it('probabilities sum to ~1', () => {
    const answers: GameAnswer[] = [{ questionId: 'fast', value: 'yes' }]
    const probs = calculateProbabilities([charA, charB, charC], answers)
    const total = Array.from(probs.values()).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1)
  })

  it('returns empty map for empty character list', () => {
    const probs = calculateProbabilities([], [])
    expect(probs.size).toBe(0)
  })

  it('strongly demotes character that contradicts a no answer', () => {
    const answers: GameAnswer[] = [{ questionId: 'fast', value: 'no' }]
    const probs = calculateProbabilities([charA, charB], answers)
    // charA has fast=true, contradicts 'no' → low score
    expect(probs.get('a')).toBeLessThan(probs.get('b')!)
  })
})
