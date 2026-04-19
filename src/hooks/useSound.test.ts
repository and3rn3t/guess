// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSound } from './useSound'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
})

vi.mock('@/lib/sounds', () => {
  let muted = false
  return {
    isMuted: () => muted,
    setMuted: (v: boolean) => { muted = v },
    toggleMute: () => { muted = !muted; return muted },
  }
})

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
  vi.clearAllMocks()
})

describe('useSound', () => {
  it('returns muted state', () => {
    const { result } = renderHook(() => useSound())
    expect(typeof result.current.muted).toBe('boolean')
  })

  it('toggles mute state', () => {
    const { result } = renderHook(() => useSound())
    const initial = result.current.muted
    act(() => { result.current.toggle() })
    expect(result.current.muted).toBe(!initial)
  })

  it('persists muted state to localStorage on toggle', () => {
    const { result } = renderHook(() => useSound())
    act(() => { result.current.toggle() })
    expect(store['kv:sound-muted']).toBeDefined()
  })

  it('restores muted state from localStorage', () => {
    store['kv:sound-muted'] = 'true'
    const { result } = renderHook(() => useSound())
    expect(result.current.muted).toBe(true)
  })

  it('provides a stable toggle function', () => {
    const { result, rerender } = renderHook(() => useSound())
    const firstToggle = result.current.toggle
    rerender()
    expect(result.current.toggle).toBe(firstToggle)
  })
})
