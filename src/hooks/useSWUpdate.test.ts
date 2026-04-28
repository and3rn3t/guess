// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSWUpdate } from './useSWUpdate'

function setupServiceWorkerMock() {
  const listeners = new Map<string, EventListener>()
  const swMock = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners.set(type, handler)
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type)
    }),
    dispatch: (event: MessageEvent) => {
      listeners.get('message')?.(event)
    },
  }

  Object.defineProperty(navigator, 'serviceWorker', {
    value: swMock,
    configurable: true,
    writable: true,
  })

  return { swMock, listeners }
}

describe('useSWUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns updateAvailable false by default', () => {
    const { swMock } = setupServiceWorkerMock()
    const { result } = renderHook(() => useSWUpdate())
    expect(result.current.updateAvailable).toBe(false)
    expect(swMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('sets updateAvailable true on SW_UPDATED message', () => {
    const { swMock } = setupServiceWorkerMock()
    const { result } = renderHook(() => useSWUpdate())

    act(() => {
      swMock.dispatch(new MessageEvent('message', { data: { type: 'SW_UPDATED' } }))
    })

    expect(result.current.updateAvailable).toBe(true)
  })

  it('ignores unrelated service worker messages', () => {
    const { swMock } = setupServiceWorkerMock()
    const { result } = renderHook(() => useSWUpdate())

    act(() => {
      swMock.dispatch(new MessageEvent('message', { data: { type: 'OTHER_MESSAGE' } }))
    })

    expect(result.current.updateAvailable).toBe(false)
  })

  it('removes event listener on unmount', () => {
    const { swMock } = setupServiceWorkerMock()
    const { unmount } = renderHook(() => useSWUpdate())
    unmount()
    expect(swMock.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('reload calls window.location.reload', () => {
    setupServiceWorkerMock()
    const reloadSpy = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: reloadSpy } as unknown as Location)
    const { result } = renderHook(() => useSWUpdate())
    act(() => { result.current.reload() })
    expect(reloadSpy).toHaveBeenCalled()
  })
})
