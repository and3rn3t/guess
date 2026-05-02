import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assignVariant, DEFAULT_SELECTOR } from './_ab'

interface KvStub {
  get: (key: string) => Promise<string | null>
}

function makeKv(values: Record<string, string | null>): KvStub {
  return {
    get: (key: string) => Promise.resolve(values[key] ?? null),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-11-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('assignVariant', () => {
  it('uses question_expansion_v1 flag when configured', async () => {
    const kv = makeKv({
      'ff:question_expansion_v1_pct': '100',
      'ff:question_expansion_v1_selector': 'greedy',
      'ab:experiment-pct': '0',
    })
    const result = await assignVariant(kv as unknown as KVNamespace, 'user-1')
    expect(result).toEqual({ variant: 'experiment', selector: 'greedy' })
  })

  it('uses stable per-user bucketing for question_expansion_v1', async () => {
    const kv = makeKv({
      'ff:question_expansion_v1_pct': '50',
      'ff:question_expansion_v1_selector': 'mcts',
    })

    const day1 = await assignVariant(kv as unknown as KVNamespace, 'sticky-user')
    vi.setSystemTime(new Date('2025-11-14T12:00:00Z'))
    const day14 = await assignVariant(kv as unknown as KVNamespace, 'sticky-user')

    expect(day14).toEqual(day1)
  })

  it('returns control + default selector when KV is empty', async () => {
    const kv = makeKv({})
    const result = await assignVariant(kv as unknown as KVNamespace, 'user-1')
    expect(result).toEqual({ variant: 'control', selector: DEFAULT_SELECTOR })
  })

  it('returns control when pct is 0', async () => {
    const kv = makeKv({ 'ab:experiment-pct': '0', 'ab:experiment-selector': 'greedy' })
    const result = await assignVariant(kv as unknown as KVNamespace, 'user-1')
    expect(result.variant).toBe('control')
    expect(result.selector).toBe(DEFAULT_SELECTOR)
  })

  it('returns control + default selector when pct is invalid', async () => {
    const kv = makeKv({ 'ab:experiment-pct': 'not-a-number' })
    const result = await assignVariant(kv as unknown as KVNamespace, 'user-1')
    expect(result.variant).toBe('control')
  })

  it('routes everyone to experiment when pct is 100', async () => {
    const kv = makeKv({ 'ab:experiment-pct': '100', 'ab:experiment-selector': 'greedy' })
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const result = await assignVariant(kv as unknown as KVNamespace, id)
      expect(result.variant).toBe('experiment')
      expect(result.selector).toBe('greedy')
    }
  })

  it('falls back to default selector when KV selector is unknown', async () => {
    const kv = makeKv({ 'ab:experiment-pct': '100', 'ab:experiment-selector': 'bogus' })
    const result = await assignVariant(kv as unknown as KVNamespace, 'user-1')
    expect(result.variant).toBe('experiment')
    expect(result.selector).toBe(DEFAULT_SELECTOR)
  })

  it('is sticky: same userId + same day yields same variant', async () => {
    const kv = makeKv({ 'ab:experiment-pct': '50', 'ab:experiment-selector': 'greedy' })
    const first = await assignVariant(kv as unknown as KVNamespace, 'sticky-user')
    const second = await assignVariant(kv as unknown as KVNamespace, 'sticky-user')
    const third = await assignVariant(kv as unknown as KVNamespace, 'sticky-user')
    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })

  it('may flip across days for the same user', async () => {
    const kv = makeKv({ 'ab:experiment-pct': '50', 'ab:experiment-selector': 'greedy' })
    const variants = new Set<string>()
    for (let day = 1; day <= 14; day++) {
      vi.setSystemTime(new Date(`2025-11-${String(day).padStart(2, '0')}T12:00:00Z`))
      const result = await assignVariant(kv as unknown as KVNamespace, 'cross-day-user')
      variants.add(result.variant)
    }
    expect(variants.size).toBe(2)
  })

  it('produces an approximately correct split across many users', async () => {
    const kv = makeKv({ 'ab:experiment-pct': '20', 'ab:experiment-selector': 'greedy' })
    let experimentCount = 0
    const N = 2000
    for (let i = 0; i < N; i++) {
      const result = await assignVariant(kv as unknown as KVNamespace, `user-${i}`)
      if (result.variant === 'experiment') experimentCount++
    }
    const pct = (experimentCount / N) * 100
    // Generous bounds: djb2 isn't a perfect hash but should land within ±5pp of 20%.
    expect(pct).toBeGreaterThan(15)
    expect(pct).toBeLessThan(25)
  })
})
