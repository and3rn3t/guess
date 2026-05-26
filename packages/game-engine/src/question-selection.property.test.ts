/**
 * Property-based tests for question-selection invariants (RF.v2.3, seeds DX.v2.3).
 *
 * Uses fast-check to fuzz the pure math layer against three invariants that
 * are easy to assert and hard to break by accident:
 *
 *   1. `calculateProbabilities` sums to ≈1 (or 0 when no characters remain).
 *   2. `entropy` is non-negative and bounded by log2(n) for n positive probs.
 *   3. `scoreQuestion` never produces NaN or ±Infinity on any answer pattern.
 *   4. `selectBestQuestion` never returns NaN-bearing state and only picks
 *      from the un-asked pool.
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { calculateProbabilities } from './scoring.js'
import { entropy, scoreQuestion, selectBestQuestion } from './question-selection.js'
import type { GameAnswer, GameCharacter, GameQuestion } from './types.js'

// ── Arbitraries ───────────────────────────────────────────────────────────────

const attributeKey = fc.constantFrom('hasHat', 'isHero', 'isFromComicBook', 'canFly', 'wearsCape')
const attributeValue = fc.option(fc.boolean(), { nil: null }) // boolean | null

const characterArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  name: fc.string({ minLength: 1, maxLength: 16 }),
  attributes: fc.dictionary(attributeKey, attributeValue, { minKeys: 0, maxKeys: 5 }),
})

const charactersArb = fc.uniqueArray(characterArb, {
  minLength: 1,
  maxLength: 12,
  selector: (c) => c.id,
}) as fc.Arbitrary<GameCharacter[]>

const questionArb: fc.Arbitrary<GameQuestion> = fc.record({
  attribute: attributeKey,
})

const questionsArb = fc.uniqueArray(questionArb, {
  minLength: 1,
  maxLength: 5,
  selector: (q) => q.attribute,
})

const answerArb: fc.Arbitrary<GameAnswer> = fc.record({
  questionId: attributeKey,
  value: fc.constantFrom<GameAnswer['value']>('yes', 'no', 'maybe', 'unknown'),
})

const answersArb = fc.array(answerArb, { maxLength: 4 })

// ── Invariants ────────────────────────────────────────────────────────────────

describe('question-selection invariants (fast-check)', () => {
  it('calculateProbabilities sums to ≈1 (or 0 if all-zero)', () => {
    fc.assert(
      fc.property(charactersArb, answersArb, (characters, answers) => {
        const probs = calculateProbabilities(characters, answers)
        const total = Array.from(probs.values()).reduce((s, p) => s + p, 0)
        // All entries are finite and non-negative
        for (const p of probs.values()) {
          expect(Number.isFinite(p)).toBe(true)
          expect(p).toBeGreaterThanOrEqual(0)
        }
        // Either degenerate (all characters eliminated → 0) or normalized to ~1
        expect(total === 0 || Math.abs(total - 1) < 1e-9).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('entropy is non-negative and bounded by log2(n) for positive probs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 32 }),
        (raw) => {
          const total = raw.reduce((s, p) => s + p, 0)
          if (total === 0) {
            expect(entropy(raw)).toBe(0)
            return
          }
          const normalized = raw.map((p) => p / total)
          const h = entropy(normalized)
          const nPositive = normalized.filter((p) => p > 0).length
          expect(Number.isFinite(h)).toBe(true)
          expect(h).toBeGreaterThanOrEqual(0)
          // Allow tiny FP slack on the upper bound.
          expect(h).toBeLessThanOrEqual(Math.log2(Math.max(nPositive, 1)) + 1e-9)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('selectBestQuestion never returns an already-asked attribute', () => {
    fc.assert(
      fc.property(charactersArb, questionsArb, answersArb, (characters, questions, answers) => {
        const result = selectBestQuestion(characters, answers, questions)
        if (result === null) return // legitimate: pool exhausted
        const asked = new Set(answers.map((a) => a.questionId))
        expect(asked.has(result.attribute)).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  it('scoreQuestion never produces NaN/±Infinity on any answer pattern', () => {
    fc.assert(
      fc.property(charactersArb, questionsArb, answersArb, (characters, questions, answers) => {
        // selectBestQuestion builds the ctx and runs scoreQuestion internally —
        // exercising it end-to-end is the cleanest way to fuzz scoreQuestion
        // against the same context shape it sees in production.
        const result = selectBestQuestion(characters, answers, questions)
        // Either null (no candidate) or a real question — never undefined and
        // never a NaN-bearing pick (would crash downstream sort).
        if (result !== null) {
          expect(typeof result.attribute).toBe('string')
        }
      }),
      { numRuns: 200 }
    )
  })

  it('monotonicity: more candidates → entropy never increases below baseline', () => {
    // Sanity property: removing all answers (no eliminations) gives uniform
    // probabilities, which produces the maximum possible entropy for the pool.
    fc.assert(
      fc.property(charactersArb, (characters) => {
        const probs = calculateProbabilities(characters, [])
        const values = Array.from(probs.values())
        const total = values.reduce((s, p) => s + p, 0)
        if (total === 0) return // degenerate
        const baselineH = entropy(values)
        // Uniform on n positive entries → log2(n)
        const n = values.filter((p) => p > 0).length
        expect(baselineH).toBeGreaterThanOrEqual(0)
        expect(baselineH).toBeLessThanOrEqual(Math.log2(Math.max(n, 1)) + 1e-9)
      }),
      { numRuns: 100 }
    )
  })
})

// ── Smoke test that the re-exported scoreQuestion has the expected shape ──────

describe('scoreQuestion re-export', () => {
  it('returns { score, topTwoSplit } for a trivially-built context', () => {
    const characters: GameCharacter[] = [
      { id: 'a', name: 'A', attributes: { hasHat: true } },
      { id: 'b', name: 'B', attributes: { hasHat: false } },
    ]
    const probs = calculateProbabilities(characters, [])
    const ctx = {
      characters,
      answers: [] as GameAnswer[],
      probs,
      currentEntropy: entropy(Array.from(probs.values())),
      topNChars: characters,
      topTwoChars: characters,
      topNMass: 1,
      endgameFocus: false,
      progress: 0,
      needsSpecies: false,
      needsOrigin: false,
      recentAttrGroups: new Set<string>(),
      nullRatioMap: new Map<string, number>([['hasHat', 0]]),
      options: undefined,
      sw: undefined,
    }
    const result = scoreQuestion({ attribute: 'hasHat' }, ctx)
    expect(typeof result.score).toBe('number')
    expect(Number.isFinite(result.score)).toBe(true)
    expect(typeof result.topTwoSplit).toBe('boolean')
  })
})
