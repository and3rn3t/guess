// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAdaptiveDifficulty } from './useAdaptiveDifficulty'
import type { GameHistoryEntry } from '@/lib/types'

// Mock sonner so toasts don't error in test environment
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

function makeGame(won: boolean, difficulty: 'easy' | 'medium' | 'hard' = 'easy'): GameHistoryEntry {
  return {
    id: `g-${Math.random()}`,
    characterId: 'c1',
    characterName: 'Test',
    won,
    timestamp: Date.now(),
    difficulty,
    totalQuestions: 10,
    steps: [],
  }
}

describe('useAdaptiveDifficulty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when gamePhase is not welcome', async () => {
    const { toast } = await import('sonner')
    const history = Array.from({ length: 10 }, () => makeGame(true, 'easy'))
    renderHook(() => useAdaptiveDifficulty('playing', 'easy', history, vi.fn()))
    expect(toast).not.toHaveBeenCalled()
  })

  it('does nothing when difficulty is hard', async () => {
    const { toast } = await import('sonner')
    const history = Array.from({ length: 10 }, () => makeGame(true, 'hard'))
    renderHook(() => useAdaptiveDifficulty('welcome', 'hard', history, vi.fn()))
    expect(toast).not.toHaveBeenCalled()
  })

  it('does nothing when fewer than 10 games at current difficulty', async () => {
    const { toast } = await import('sonner')
    const history = Array.from({ length: 9 }, () => makeGame(true, 'easy'))
    renderHook(() => useAdaptiveDifficulty('welcome', 'easy', history, vi.fn()))
    expect(toast).not.toHaveBeenCalled()
  })

  it('does nothing when history is undefined', async () => {
    const { toast } = await import('sonner')
    renderHook(() => useAdaptiveDifficulty('welcome', 'easy', undefined, vi.fn()))
    expect(toast).not.toHaveBeenCalled()
  })

  it('shows toast when win rate ≥ 80% over last 10 games', async () => {
    const { toast } = await import('sonner')
    // 8 wins, 2 losses = 80%
    const history = [
      ...Array.from({ length: 8 }, () => makeGame(true, 'easy')),
      ...Array.from({ length: 2 }, () => makeGame(false, 'easy')),
    ]
    renderHook(() => useAdaptiveDifficulty('welcome', 'easy', history, vi.fn()))
    expect(toast).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('Medium'),
      expect.objectContaining({ action: expect.any(Object) }),
    )
  })

  it('does not show toast when win rate < 80%', async () => {
    const { toast } = await import('sonner')
    // 7 wins, 3 losses = 70%
    const history = [
      ...Array.from({ length: 7 }, () => makeGame(true, 'easy')),
      ...Array.from({ length: 3 }, () => makeGame(false, 'easy')),
    ]
    renderHook(() => useAdaptiveDifficulty('welcome', 'easy', history, vi.fn()))
    expect(toast).not.toHaveBeenCalled()
  })

  it('only fires once per session (ref guard)', async () => {
    const { toast } = await import('sonner')
    const history = Array.from({ length: 10 }, () => makeGame(true, 'easy'))
    const { rerender } = renderHook(
      ({ phase }: { phase: 'welcome' | 'playing' }) =>
        useAdaptiveDifficulty(phase, 'easy', history, vi.fn()),
      { initialProps: { phase: 'welcome' as 'welcome' | 'playing' } },
    )
    rerender({ phase: 'playing' })
    rerender({ phase: 'welcome' })
    // Toast should only have fired once (first welcome render)
    expect(toast).toHaveBeenCalledOnce()
  })
})
