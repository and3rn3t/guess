// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKV } from './useKV'

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

describe('useKV', () => {
  it('returns default value when localStorage is empty', () => {
    const { result } = renderHook(() => useKV('test-key', 42))
    expect(result.current[0]).toBe(42)
  })

  it('reads initial value from localStorage', () => {
    store['kv:saved'] = JSON.stringify('hello')
    const { result } = renderHook(() => useKV('saved', 'default'))
    expect(result.current[0]).toBe('hello')
  })

  it('updates value via setter', () => {
    const { result } = renderHook(() => useKV('counter', 0))
    act(() => result.current[1](5))
    expect(result.current[0]).toBe(5)
  })

  it('supports functional updates', () => {
    const { result } = renderHook(() => useKV('counter', 10))
    act(() => result.current[1]((prev) => prev + 1))
    expect(result.current[0]).toBe(11)
  })

  it('persists to localStorage after debounce', () => {
    const { result } = renderHook(() => useKV('debounced', 'a'))
    act(() => result.current[1]('b'))
    // Before debounce, localStorage should not be updated
    expect(store['kv:debounced']).toBeUndefined()
    // After debounce (300ms)
    act(() => { vi.advanceTimersByTime(350) })
    expect(store['kv:debounced']).toBe(JSON.stringify('b'))
  })

  it('syncs from cross-tab storage events', () => {
    const { result } = renderHook(() => useKV('synced', 'original'))
    act(() => {
      globalThis.dispatchEvent(new StorageEvent('storage', {
        key: 'kv:synced',
        newValue: JSON.stringify('from-other-tab'),
      }))
    })
    expect(result.current[0]).toBe('from-other-tab')
  })

  it('resets to default when storage event has null newValue', () => {
    store['kv:deletable'] = JSON.stringify('exists')
    const { result } = renderHook(() => useKV('deletable', 'default'))
    expect(result.current[0]).toBe('exists')
    act(() => {
      globalThis.dispatchEvent(new StorageEvent('storage', {
        key: 'kv:deletable',
        newValue: null,
      }))
    })
    expect(result.current[0]).toBe('default')
  })

  it('ignores storage events for different keys', () => {
    const { result } = renderHook(() => useKV('mine', 'original'))
    act(() => {
      globalThis.dispatchEvent(new StorageEvent('storage', {
        key: 'kv:other',
        newValue: JSON.stringify('changed'),
      }))
    })
    expect(result.current[0]).toBe('original')
  })

  it('calls onError when localStorage throws on read', () => {
    const onError = vi.fn()
    vi.mocked(localStorage.getItem).mockImplementationOnce(() => { throw new Error('quota') })
    renderHook(() => useKV('broken', 'fallback', { onError }))
    expect(onError).toHaveBeenCalledOnce()
  })

  it('handles complex object values', () => {
    const obj = { nested: { value: [1, 2, 3] } }
    const { result } = renderHook(() => useKV('complex', obj))
    expect(result.current[0]).toEqual(obj)
    const updated = { nested: { value: [4, 5] } }
    act(() => result.current[1](updated))
    expect(result.current[0]).toEqual(updated)
  })
})
