import { describe, expect, it } from 'vitest'

import { computeQueueAging, computeSlaMisses } from './_completeness_burndown'

describe('computeSlaMisses', () => {
  const rules = [
    { attributeKey: 'isHuman', targets: { 'video-games': 1.0, movies: 0.95 } },
    { attributeKey: 'personality', targets: { 'video-games': 0.7, movies: 0.6 } },
  ]

  it('returns empty when all targets are met', () => {
    const actual = new Map([
      ['isHuman', new Map([['video-games', 1.0], ['movies', 0.95]])],
      ['personality', new Map([['video-games', 0.8], ['movies', 0.7]])],
    ])
    expect(computeSlaMisses(rules, actual)).toEqual([])
  })

  it('returns misses sorted by descending gap', () => {
    const actual = new Map([
      ['isHuman', new Map([['video-games', 0.5], ['movies', 0.95]])],
      ['personality', new Map([['video-games', 0.65], ['movies', 0.6]])],
    ])
    // isHuman/video-games gap = 0.5, personality/video-games gap = 0.05
    const misses = computeSlaMisses(rules, actual)
    expect(misses).toHaveLength(2)
    expect(misses[0].attributeKey).toBe('isHuman')
    expect(misses[0].category).toBe('video-games')
    expect(misses[0].gap).toBeCloseTo(0.5, 4)
    expect(misses[1].attributeKey).toBe('personality')
    expect(misses[1].gap).toBeCloseTo(0.05, 4)
  })

  it('treats missing actual entry as 0', () => {
    const actual = new Map<string, ReadonlyMap<string, number>>()
    const misses = computeSlaMisses(rules, actual)
    // every (attr, category) pair is a miss since actual defaults to 0
    expect(misses.length).toBe(4) // 2 attrs × 2 categories
    expect(misses.every((m) => m.actual === 0)).toBe(true)
    // sorted by gap desc: isHuman/video-games (gap 1.0) first
    expect(misses[0].gap).toBe(1.0)
  })

  it('rounds actual and gap to 4 decimal places', () => {
    const actual = new Map([
      ['isHuman', new Map([['video-games', 1 / 3]])],
    ])
    const misses = computeSlaMisses([{ attributeKey: 'isHuman', targets: { 'video-games': 1.0 } }], actual)
    expect(misses[0].actual).toBe(0.3333)
    expect(misses[0].gap).toBe(0.6667)
  })
})

describe('computeQueueAging', () => {
  it('returns zeros for empty list', () => {
    expect(computeQueueAging([])).toEqual({
      totalItems: 0,
      medianAgeDays: 0,
      p90AgeDays: 0,
      oldestItemDays: 0,
    })
  })

  it('returns correct stats for single item ~1 day old', () => {
    const oneDayAgo = Date.now() / 1000 - 86400
    const result = computeQueueAging([{ createdAtSec: oneDayAgo }])
    expect(result.totalItems).toBe(1)
    expect(result.medianAgeDays).toBeCloseTo(1, 0)
    expect(result.oldestItemDays).toBeCloseTo(1, 0)
  })

  it('computes median and p90 for 10 items (0..9 days old)', () => {
    const now = Date.now() / 1000
    const items = Array.from({ length: 10 }, (_, i) => ({ createdAtSec: now - i * 86400 }))
    const result = computeQueueAging(items)
    expect(result.totalItems).toBe(10)
    // ages sorted: 0,1,2,3,4,5,6,7,8,9 → median=(4+5)/2=4.5
    expect(result.medianAgeDays).toBeCloseTo(4.5, 0)
    // p90 idx = floor(10*0.9)=9 → age=9
    expect(result.p90AgeDays).toBeCloseTo(9, 0)
    expect(result.oldestItemDays).toBeCloseTo(9, 0)
  })

  it('clamps negative ages to 0 (future createdAt)', () => {
    const futureTs = Date.now() / 1000 + 86400
    const result = computeQueueAging([{ createdAtSec: futureTs }])
    expect(result.oldestItemDays).toBe(0)
  })
})
