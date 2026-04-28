// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersonalBest } from './usePersonalBest'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
})

beforeEach(() => {
  vi.useFakeTimers()
  for (const key of Object.keys(store)) delete store[key]
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePersonalBest', () => {
  it('returns null when no personal best recorded', () => {
    const { result } = renderHook(() => usePersonalBest('medium'))
    expect(result.current.personalBest).toBeNull()
  })

  it('records a new personal best when none exists', () => {
    const { result } = renderHook(() => usePersonalBest('medium'))
    let isNew: boolean
    act(() => {
      isNew = result.current.updateBest(8)
    })
    act(() => { vi.advanceTimersByTime(350) })
    expect(isNew!).toBe(true)
    expect(result.current.personalBest).toBe(8)
  })

  it('updates when a better (lower) score is achieved', () => {
    store['kv:personal-bests'] = JSON.stringify({ medium: 10 })
    const { result } = renderHook(() => usePersonalBest('medium'))
    expect(result.current.personalBest).toBe(10)

    let isNew: boolean
    act(() => { isNew = result.current.updateBest(7) })
    act(() => { vi.advanceTimersByTime(350) })
    expect(isNew!).toBe(true)
    expect(result.current.personalBest).toBe(7)
  })

  it('does not update when score is not better', () => {
    store['kv:personal-bests'] = JSON.stringify({ medium: 8 })
    const { result } = renderHook(() => usePersonalBest('medium'))

    let isNew: boolean
    act(() => { isNew = result.current.updateBest(10) })
    expect(isNew!).toBe(false)
    expect(result.current.personalBest).toBe(8)
  })

  it('does not update when score equals the current best', () => {
    store['kv:personal-bests'] = JSON.stringify({ medium: 8 })
    const { result } = renderHook(() => usePersonalBest('medium'))

    let isNew: boolean
    act(() => { isNew = result.current.updateBest(8) })
    expect(isNew!).toBe(false)
  })

  it('tracks bests independently per difficulty', () => {
    const { result: easyResult } = renderHook(() => usePersonalBest('easy'))
    const { result: hardResult } = renderHook(() => usePersonalBest('hard'))

    act(() => { easyResult.current.updateBest(12) })
    act(() => { hardResult.current.updateBest(5) })
    act(() => { vi.advanceTimersByTime(350) })

    expect(easyResult.current.personalBest).toBe(12)
    expect(hardResult.current.personalBest).toBe(5)
  })
})
