// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDailyStreak } from './useDailyStreak'
import type { GameHistoryEntry } from '@/lib/types'

function makeGame(won: boolean, daysAgo: number): GameHistoryEntry {
  const ts = Date.now() - daysAgo * 86_400_000
  return {
    id: `g-${daysAgo}`,
    characterId: 'c1',
    characterName: 'Test',
    won,
    timestamp: ts,
    difficulty: 'medium',
    totalQuestions: 10,
    steps: [],
  }
}

describe('useDailyStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for null history', () => {
    const { result } = renderHook(() => useDailyStreak(null))
    expect(result.current).toBe(0)
  })

  it('returns 0 for empty history', () => {
    const { result } = renderHook(() => useDailyStreak([]))
    expect(result.current).toBe(0)
  })

  it('returns 0 when no games won', () => {
    const history = [makeGame(false, 0), makeGame(false, 1)]
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(0)
  })

  it('returns 1 for a win today only', () => {
    const { result } = renderHook(() => useDailyStreak([makeGame(true, 0)]))
    expect(result.current).toBe(1)
  })

  it('counts consecutive days ending today', () => {
    const history = [0, 1, 2].map((d) => makeGame(true, d))
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(3)
  })

  it('counts consecutive days ending yesterday', () => {
    const history = [1, 2, 3].map((d) => makeGame(true, d))
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(3)
  })

  it('breaks streak for a gap in days', () => {
    // Win today and 2 days ago, but NOT yesterday
    const history = [makeGame(true, 0), makeGame(true, 2)]
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(1)
  })

  it('returns 0 when last win was 2+ days ago', () => {
    const history = [makeGame(true, 2), makeGame(true, 3)]
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(0)
  })

  it('ignores losses when counting streak', () => {
    // Wins on day 0, 1; loss on day 2 should not break the streak back-count
    const history = [makeGame(true, 0), makeGame(true, 1), makeGame(false, 2)]
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(2)
  })

  it('deduplicates multiple wins on the same day', () => {
    // Two wins today — should still count as 1 day
    const history = [makeGame(true, 0), makeGame(true, 0), makeGame(true, 1)]
    const { result } = renderHook(() => useDailyStreak(history))
    expect(result.current).toBe(2)
  })
})
