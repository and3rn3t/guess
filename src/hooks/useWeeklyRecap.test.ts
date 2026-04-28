// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWeeklyRecap } from './useWeeklyRecap'
import type { GameHistoryEntry } from '@/lib/types'

function makeGame(
  daysAgo: number,
  won: boolean,
  steps = 10,
  characterName = 'Test',
): GameHistoryEntry {
  return {
    id: `g-${daysAgo}-${Math.random()}`,
    characterId: 'c1',
    characterName,
    won,
    timestamp: Date.now() - daysAgo * 86_400_000,
    difficulty: 'medium',
    totalQuestions: steps,
    steps: Array.from({ length: steps }, (_, i) => ({
      questionText: `Q${i}`,
      attribute: `a${i}`,
      answer: 'yes' as const,
    })),
  }
}

describe('useWeeklyRecap', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null on non-Monday', () => {
    // April 28, 2026 is a Tuesday
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00'))
    const history = [makeGame(8, true)] // last week
    const { result } = renderHook(() => useWeeklyRecap(history))
    expect(result.current).toBeNull()
  })

  it('returns null for null history', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00')) // Monday
    const { result } = renderHook(() => useWeeklyRecap(null))
    expect(result.current).toBeNull()
  })

  it('returns null on Monday with no games last week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00')) // Monday
    const { result } = renderHook(() => useWeeklyRecap([]))
    expect(result.current).toBeNull()
  })

  it('returns recap on Monday with last-week games', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00')) // Monday Apr 27, 2026
    // Last week: Mon Apr 20 – Sun Apr 26. Games on Apr 21 (7 days ago) and Apr 22 (6 days ago)
    const history = [makeGame(6, true, 10, 'Goku'), makeGame(7, false, 15)]
    const { result } = renderHook(() => useWeeklyRecap(history))
    expect(result.current).not.toBeNull()
    expect(result.current!.gamesPlayed).toBe(2)
    expect(result.current!.wins).toBe(1)
    expect(result.current!.winRate).toBeCloseTo(0.5)
    expect(result.current!.avgQuestions).toBeCloseTo(12.5)
    expect(result.current!.hardestCharacter).toBe('Goku')
    expect(result.current!.weekStart).toBe('2026-04-20')
  })

  it('sets hardestCharacter to null when no wins last week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00'))
    const history = [makeGame(6, false, 10)]
    const { result } = renderHook(() => useWeeklyRecap(history))
    expect(result.current!.hardestCharacter).toBeNull()
    expect(result.current!.wins).toBe(0)
  })

  it('returns null on Monday if games are from this week (not last week)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00')) // Monday
    // Game from today (0 days ago) — falls in current week, not last week
    const history = [makeGame(0, true)]
    const { result } = renderHook(() => useWeeklyRecap(history))
    expect(result.current).toBeNull()
  })
})
