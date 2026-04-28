// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEliminationTracker } from './useEliminationTracker'

describe('useEliminationTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with eliminatedCount null', () => {
    const { result } = renderHook(() => useEliminationTracker(100))
    expect(result.current.eliminatedCount).toBeNull()
  })

  it('shows elimination count when remaining drops', () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useEliminationTracker(n),
      { initialProps: { n: 100 } },
    )
    rerender({ n: 60 })
    expect(result.current.eliminatedCount).toBe(40)
  })

  it('clears eliminatedCount after 2 seconds', () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useEliminationTracker(n),
      { initialProps: { n: 100 } },
    )
    rerender({ n: 60 })
    expect(result.current.eliminatedCount).toBe(40)

    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.eliminatedCount).toBeNull()
  })

  it('does not flash when remaining increases', () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useEliminationTracker(n),
      { initialProps: { n: 50 } },
    )
    rerender({ n: 80 })
    expect(result.current.eliminatedCount).toBeNull()
  })

  it('records remaining history in remainingHistoryRef', () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useEliminationTracker(n),
      { initialProps: { n: 100 } },
    )
    rerender({ n: 60 })
    rerender({ n: 40 })
    expect(result.current.remainingHistoryRef.current).toContain(60)
    expect(result.current.remainingHistoryRef.current).toContain(40)
  })

  it('reset clears state and history', () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useEliminationTracker(n),
      { initialProps: { n: 100 } },
    )
    rerender({ n: 60 })
    act(() => { result.current.reset() })
    expect(result.current.eliminatedCount).toBeNull()
    expect(result.current.remainingHistoryRef.current).toHaveLength(0)
  })
})
