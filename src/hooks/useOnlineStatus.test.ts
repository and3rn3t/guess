// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

let navigatorOnLine = true
vi.stubGlobal('navigator', {
  get onLine() { return navigatorOnLine },
})

beforeEach(() => {
  navigatorOnLine = true
  vi.clearAllMocks()
})

describe('useOnlineStatus', () => {
  it('returns true when online', () => {
    const { result } = renderHook(() => useOnlineStatus(false))
    expect(result.current).toBe(true)
  })

  it('returns false when initially offline', () => {
    navigatorOnLine = false
    const { result } = renderHook(() => useOnlineStatus(false))
    expect(result.current).toBe(false)
  })

  it('updates on offline event', () => {
    const { result } = renderHook(() => useOnlineStatus(false))
    act(() => {
      globalThis.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
  })

  it('updates on online event', () => {
    navigatorOnLine = false
    const { result } = renderHook(() => useOnlineStatus(false))
    act(() => {
      globalThis.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('shows toast when going offline in LLM mode', async () => {
    const { toast } = await import('sonner')
    renderHook(() => useOnlineStatus(true))
    act(() => {
      globalThis.dispatchEvent(new Event('offline'))
    })
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('AI-Enhanced'),
    )
  })

  it('shows toast when going offline in server mode', async () => {
    const { toast } = await import('sonner')
    renderHook(() => useOnlineStatus(false, true))
    act(() => {
      globalThis.dispatchEvent(new Event('offline'))
    })
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Server mode'),
    )
  })

  it('does not show toast when not in LLM or server mode', async () => {
    const { toast } = await import('sonner')
    renderHook(() => useOnlineStatus(false, false))
    act(() => {
      globalThis.dispatchEvent(new Event('offline'))
    })
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener')
    const removeSpy = vi.spyOn(globalThis, 'removeEventListener')
    const { unmount } = renderHook(() => useOnlineStatus(false))

    const onlineHandler = addSpy.mock.calls.find(c => c[0] === 'online')?.[1]
    const offlineHandler = addSpy.mock.calls.find(c => c[0] === 'offline')?.[1]

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('online', onlineHandler)
    expect(removeSpy).toHaveBeenCalledWith('offline', offlineHandler)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
