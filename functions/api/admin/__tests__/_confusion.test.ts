import { describe, expect, it } from 'vitest'
import {
  formatRealPair,
  formatSimPair,
  parseConfusionParams,
  type RealConfusionRow,
  type SimConfusionRow,
} from '../_confusion'

describe('parseConfusionParams', () => {
  it('returns defaults when nothing is provided', () => {
    const out = parseConfusionParams(new URLSearchParams())
    expect(out).toEqual({ source: 'real', limit: 50, minConfusions: 2 })
  })

  it('accepts source=sim', () => {
    const out = parseConfusionParams(new URLSearchParams('source=sim'))
    expect(out.source).toBe('sim')
  })

  it('falls back to real for an unknown source', () => {
    const out = parseConfusionParams(new URLSearchParams('source=bogus'))
    expect(out.source).toBe('real')
  })

  it('clamps limit to [5, 200]', () => {
    expect(parseConfusionParams(new URLSearchParams('limit=1')).limit).toBe(5)
    expect(parseConfusionParams(new URLSearchParams('limit=99')).limit).toBe(99)
    expect(parseConfusionParams(new URLSearchParams('limit=10000')).limit).toBe(200)
    expect(parseConfusionParams(new URLSearchParams('limit=oops')).limit).toBe(50)
  })

  it('floors minConfusions at 1', () => {
    expect(parseConfusionParams(new URLSearchParams('minConfusions=0')).minConfusions).toBe(1)
    expect(parseConfusionParams(new URLSearchParams('minConfusions=-3')).minConfusions).toBe(1)
    expect(parseConfusionParams(new URLSearchParams('minConfusions=7')).minConfusions).toBe(7)
  })
})

describe('formatRealPair', () => {
  const base: RealConfusionRow = {
    character_a: 'naruto',
    character_b: 'sasuke',
    name_a: 'Naruto Uzumaki',
    name_b: 'Sasuke Uchiha',
    confusion_count: 14,
    last_seen: 1_714_000_000_000,
  }

  it('projects names + leaves winPct null (undirected)', () => {
    expect(formatRealPair(base)).toEqual({
      targetId: 'naruto',
      targetName: 'Naruto Uzumaki',
      confusedWithId: 'sasuke',
      confusedWithName: 'Sasuke Uchiha',
      confusionCount: 14,
      winPct: null,
      lastSeen: 1_714_000_000_000,
    })
  })

  it('falls back to the id when the character join misses', () => {
    const out = formatRealPair({ ...base, name_a: null, name_b: null })
    expect(out.targetName).toBe('naruto')
    expect(out.confusedWithName).toBe('sasuke')
  })
})

describe('formatSimPair', () => {
  it('preserves direction + winPct', () => {
    const row: SimConfusionRow = {
      targetId: 'naruto',
      targetName: 'Naruto',
      confusedWithId: 'sasuke',
      confusedWithName: 'Sasuke',
      confusionCount: 9,
      winPct: 62.5,
    }
    expect(formatSimPair(row)).toEqual({
      targetId: 'naruto',
      targetName: 'Naruto',
      confusedWithId: 'sasuke',
      confusedWithName: 'Sasuke',
      confusionCount: 9,
      winPct: 62.5,
      lastSeen: null,
    })
  })
})
