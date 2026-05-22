import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assignVariant, DEFAULT_SELECTOR } from './_ab'

/** Minimal D1Database stub that backs engine_config lookups via d1ConfigGetMulti */
function makeDb(values: Record<string, string | null>): D1Database {
  const db = {
    prepare: (_sql: string) => {
      return {
        bind: (..._args: unknown[]) => ({
          all: async <T>() => {
            // d1ConfigGetMulti: SELECT key, value FROM engine_config WHERE key IN (...)
            const rows: { key: string; value: string }[] = []
            for (const [k, v] of Object.entries(values)) {
              if (v !== null) rows.push({ key: k, value: v })
            }
            return { results: rows as T[], success: true, meta: {} }
          },
          run: async () => ({ success: true, meta: {} }),
          first: async <T>() => null as T,
        }),
        all: async <T>() => ({ results: [] as T[], success: true, meta: {} }),
        run: async () => ({ success: true, meta: {} }),
        first: async <T>() => null as T,
      }
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    withSession: () => ({}) as D1Database,
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
  return db
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
    const db = makeDb({
      'ff:question_expansion_v1_pct': '100',
      'ff:question_expansion_v1_selector': 'greedy',
      'ab:experiment-pct': '0',
    })
    const result = await assignVariant(db, 'user-1')
    expect(result).toEqual({ variant: 'experiment', selector: 'greedy' })
  })

  it('uses stable per-user bucketing for question_expansion_v1', async () => {
    const db = makeDb({
      'ff:question_expansion_v1_pct': '50',
      'ff:question_expansion_v1_selector': 'mcts',
    })

    const day1 = await assignVariant(db, 'sticky-user')
    vi.setSystemTime(new Date('2025-11-14T12:00:00Z'))
    const day14 = await assignVariant(db, 'sticky-user')

    expect(day14).toEqual(day1)
  })

  it('returns control + default selector when config is empty', async () => {
    const db = makeDb({})
    const result = await assignVariant(db, 'user-1')
    expect(result).toEqual({ variant: 'control', selector: DEFAULT_SELECTOR })
  })

  it('returns control when pct is 0', async () => {
    const db = makeDb({ 'ab:experiment-pct': '0', 'ab:experiment-selector': 'greedy' })
    const result = await assignVariant(db, 'user-1')
    expect(result.variant).toBe('control')
    expect(result.selector).toBe(DEFAULT_SELECTOR)
  })

  it('returns control + default selector when pct is invalid', async () => {
    const db = makeDb({ 'ab:experiment-pct': 'not-a-number' })
    const result = await assignVariant(db, 'user-1')
    expect(result.variant).toBe('control')
  })

  it('routes everyone to experiment when pct is 100', async () => {
    const db = makeDb({ 'ab:experiment-pct': '100', 'ab:experiment-selector': 'greedy' })
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const result = await assignVariant(db, id)
      expect(result.variant).toBe('experiment')
      expect(result.selector).toBe('greedy')
    }
  })

  it('falls back to default selector when selector is unknown', async () => {
    const db = makeDb({ 'ab:experiment-pct': '100', 'ab:experiment-selector': 'bogus' })
    const result = await assignVariant(db, 'user-1')
    expect(result.variant).toBe('experiment')
    expect(result.selector).toBe(DEFAULT_SELECTOR)
  })

  it('is sticky: same userId + same day yields same variant', async () => {
    const db = makeDb({ 'ab:experiment-pct': '50', 'ab:experiment-selector': 'greedy' })
    const first = await assignVariant(db, 'sticky-user')
    const second = await assignVariant(db, 'sticky-user')
    const third = await assignVariant(db, 'sticky-user')
    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })

  it('may flip across days for the same user', async () => {
    const db = makeDb({ 'ab:experiment-pct': '50', 'ab:experiment-selector': 'greedy' })
    const variants = new Set<string>()
    for (let day = 1; day <= 14; day++) {
      vi.setSystemTime(new Date(`2025-11-${String(day).padStart(2, '0')}T12:00:00Z`))
      const result = await assignVariant(db, 'cross-day-user')
      variants.add(result.variant)
    }
    expect(variants.size).toBe(2)
  })

  it('produces an approximately correct split across many users', async () => {
    const db = makeDb({ 'ab:experiment-pct': '20', 'ab:experiment-selector': 'greedy' })
    let experimentCount = 0
    const N = 2000
    for (let i = 0; i < N; i++) {
      const result = await assignVariant(db, `user-${i}`)
      if (result.variant === 'experiment') experimentCount++
    }
    const pct = (experimentCount / N) * 100
    // Generous bounds: djb2 isn't a perfect hash but should land within ±5pp of 20%.
    expect(pct).toBeGreaterThan(15)
    expect(pct).toBeLessThan(25)
  })
})
