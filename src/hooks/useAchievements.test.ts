// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAchievements, ALL_ACHIEVEMENTS } from './useAchievements'
import type { GameHistoryEntry } from '@/lib/types'

function makeGame(overrides: Partial<GameHistoryEntry> = {}): GameHistoryEntry {
  return {
    id: 'g1',
    characterId: 'char1',
    characterName: 'Test Character',
    won: true,
    timestamp: Date.now(),
    difficulty: 'medium',
    totalQuestions: 10,
    steps: Array.from({ length: 10 }, (_, i) => ({
      questionText: `Q${i}`,
      attribute: `attr${i}`,
      answer: 'yes' as const,
    })),
    ...overrides,
  }
}

describe('useAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array with no history', () => {
    const { result } = renderHook(() => useAchievements([], 0, 0))
    expect(result.current).toHaveLength(0)
  })

  it('returns empty array with null history', () => {
    const { result } = renderHook(() => useAchievements(null, 0, 0))
    expect(result.current).toHaveLength(0)
  })

  it('unlocks Speed Demon for a win in ≤5 questions', () => {
    const history = [makeGame({ steps: Array.from({ length: 5 }, (_, i) => ({ questionText: `Q${i}`, attribute: `a${i}`, answer: 'yes' as const })) })]
    const { result } = renderHook(() => useAchievements(history, 0, 1))
    expect(result.current.map((a) => a.id)).toContain('speed-demon')
  })

  it('does not unlock Speed Demon for a win in 6 questions', () => {
    const history = [makeGame({ steps: Array.from({ length: 6 }, (_, i) => ({ questionText: `Q${i}`, attribute: `a${i}`, answer: 'yes' as const })) })]
    const { result } = renderHook(() => useAchievements(history, 0, 1))
    expect(result.current.map((a) => a.id)).not.toContain('speed-demon')
  })

  it('does not unlock Speed Demon for a loss in ≤5 questions', () => {
    const history = [makeGame({ won: false, steps: Array.from({ length: 4 }, (_, i) => ({ questionText: `Q${i}`, attribute: `a${i}`, answer: 'yes' as const })) })]
    const { result } = renderHook(() => useAchievements(history, 0, 1))
    expect(result.current.map((a) => a.id)).not.toContain('speed-demon')
  })

  it('unlocks Hot Streak at streak ≥ 3', () => {
    const { result } = renderHook(() => useAchievements([], 3, 0))
    expect(result.current.map((a) => a.id)).toContain('hot-streak')
  })

  it('does not unlock Hot Streak at streak 2', () => {
    const { result } = renderHook(() => useAchievements([], 2, 0))
    expect(result.current.map((a) => a.id)).not.toContain('hot-streak')
  })

  it('unlocks Week Warrior at streak ≥ 7', () => {
    const { result } = renderHook(() => useAchievements([], 7, 5))
    const ids = result.current.map((a) => a.id)
    expect(ids).toContain('week-warrior')
    expect(ids).toContain('hot-streak')
  })

  it('unlocks Persistent at 10 games played', () => {
    const { result } = renderHook(() => useAchievements([], 0, 10))
    expect(result.current.map((a) => a.id)).toContain('persistent')
  })

  it('does not unlock Persistent at 9 games', () => {
    const { result } = renderHook(() => useAchievements([], 0, 9))
    expect(result.current.map((a) => a.id)).not.toContain('persistent')
  })

  it('unlocks Veteran at 50 games played', () => {
    const { result } = renderHook(() => useAchievements([], 0, 50))
    const ids = result.current.map((a) => a.id)
    expect(ids).toContain('veteran')
    expect(ids).toContain('persistent')
  })

  it('can unlock all achievements simultaneously', () => {
    const history = [makeGame({ steps: Array.from({ length: 5 }, (_, i) => ({ questionText: `Q${i}`, attribute: `a${i}`, answer: 'yes' as const })) })]
    const { result } = renderHook(() => useAchievements(history, 7, 50))
    expect(result.current).toHaveLength(ALL_ACHIEVEMENTS.length)
  })

  it('returns stable reference when inputs unchanged', () => {
    const history: GameHistoryEntry[] = []
    const { result, rerender } = renderHook(
      ({ h, s, g }: { h: GameHistoryEntry[]; s: number; g: number }) =>
        useAchievements(h, s, g),
      { initialProps: { h: history, s: 0, g: 0 } },
    )
    const first = result.current
    rerender({ h: history, s: 0, g: 0 })
    expect(result.current).toBe(first)
  })
})
