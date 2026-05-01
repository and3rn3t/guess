import { describe, expect, it } from 'vitest'
import { computeDrift, summarizeDrift, type AttributeMap } from './_drift'

describe('computeDrift', () => {
  it('returns no events when stored and fresh are identical', () => {
    const stored: AttributeMap = { isMale: 1, hasBeard: 0, isVampire: null }
    const fresh: AttributeMap = { isMale: 1, hasBeard: 0, isVampire: null }
    expect(computeDrift(stored, fresh)).toEqual([])
  })

  it('emits a contradiction when stored and fresh both have values that disagree', () => {
    const stored: AttributeMap = { isMale: 1, hasBeard: 1 }
    const fresh: AttributeMap = { isMale: 1, hasBeard: 0 }
    const events = computeDrift(stored, fresh)
    expect(events).toEqual([
      { attributeKey: 'hasBeard', oldValue: 1, newValue: 0, isContradiction: true },
    ])
  })

  it('emits a discovered event by default when stored is null and fresh has a value', () => {
    const stored: AttributeMap = { wearsCape: null }
    const fresh: AttributeMap = { wearsCape: 1 }
    const events = computeDrift(stored, fresh)
    expect(events).toEqual([
      { attributeKey: 'wearsCape', oldValue: null, newValue: 1, isContradiction: false },
    ])
  })

  it('suppresses discovered events when emitDiscovered=false', () => {
    const stored: AttributeMap = { wearsCape: null }
    const fresh: AttributeMap = { wearsCape: 1 }
    expect(computeDrift(stored, fresh, { emitDiscovered: false })).toEqual([])
  })

  it('suppresses lost events by default (stored has value, fresh null)', () => {
    const stored: AttributeMap = { wearsCape: 1 }
    const fresh: AttributeMap = { wearsCape: null }
    expect(computeDrift(stored, fresh)).toEqual([])
  })

  it('emits lost events when emitLost=true', () => {
    const stored: AttributeMap = { wearsCape: 1 }
    const fresh: AttributeMap = { wearsCape: null }
    expect(computeDrift(stored, fresh, { emitLost: true })).toEqual([
      { attributeKey: 'wearsCape', oldValue: 1, newValue: null, isContradiction: false },
    ])
  })

  it('treats both-null as no drift', () => {
    expect(
      computeDrift({ x: null }, { x: null })
    ).toEqual([])
  })

  it('treats undefined as null', () => {
    const stored: AttributeMap = { isMale: 1 }
    const fresh: AttributeMap = {}
    // fresh.isMale is undefined → treated as null → would be "lost", suppressed by default
    expect(computeDrift(stored, fresh)).toEqual([])
    expect(computeDrift(stored, fresh, { emitLost: true })).toHaveLength(1)
  })

  it('respects attributeAllowList', () => {
    const stored: AttributeMap = { isMale: 1, hasBeard: 1 }
    const fresh: AttributeMap = { isMale: 0, hasBeard: 0 }
    const events = computeDrift(stored, fresh, {
      attributeAllowList: new Set(['hasBeard']),
    })
    expect(events.map((e) => e.attributeKey)).toEqual(['hasBeard'])
  })

  it('returns events sorted by attributeKey for stable output', () => {
    const stored: AttributeMap = { zeta: 1, alpha: 1, mike: 1 }
    const fresh: AttributeMap = { zeta: 0, alpha: 0, mike: 0 }
    const events = computeDrift(stored, fresh)
    expect(events.map((e) => e.attributeKey)).toEqual(['alpha', 'mike', 'zeta'])
  })

  it('handles a mix of contradictions, discovered, and equal values', () => {
    const stored: AttributeMap = {
      isMale: 1,        // unchanged
      hasBeard: 1,      // contradiction → fresh=0
      wearsCape: null,  // discovered → fresh=1
      isVampire: null,  // unchanged
    }
    const fresh: AttributeMap = {
      isMale: 1,
      hasBeard: 0,
      wearsCape: 1,
      isVampire: null,
    }
    const events = computeDrift(stored, fresh)
    expect(events).toHaveLength(2)
    const contradictions = events.filter((e) => e.isContradiction)
    const discovered = events.filter((e) => !e.isContradiction)
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]?.attributeKey).toBe('hasBeard')
    expect(discovered).toHaveLength(1)
    expect(discovered[0]?.attributeKey).toBe('wearsCape')
  })
})

describe('summarizeDrift', () => {
  it('counts contradictions, discovered, and lost separately', () => {
    const summary = summarizeDrift([
      { attributeKey: 'a', oldValue: 1, newValue: 0, isContradiction: true },
      { attributeKey: 'b', oldValue: null, newValue: 1, isContradiction: false },
      { attributeKey: 'c', oldValue: 0, newValue: null, isContradiction: false },
      { attributeKey: 'd', oldValue: null, newValue: 0, isContradiction: false },
    ])
    expect(summary).toEqual({ total: 4, contradictions: 1, discovered: 2, lost: 1 })
  })

  it('returns zeroes for an empty list', () => {
    expect(summarizeDrift([])).toEqual({
      total: 0,
      contradictions: 0,
      discovered: 0,
      lost: 0,
    })
  })
})
