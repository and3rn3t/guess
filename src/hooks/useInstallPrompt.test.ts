// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt'

describe('useInstallPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns canInstall false by default', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
  })

  it('sets canInstall true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.canInstall).toBe(true)
  })

  it('clears canInstall when appinstalled fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.canInstall).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.canInstall).toBe(false)
  })

  it('promptInstall is a no-op when canInstall is false', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    await act(async () => {
      await result.current.promptInstall()
    })
    // No error thrown, canInstall remains false
    expect(result.current.canInstall).toBe(false)
  })
})
