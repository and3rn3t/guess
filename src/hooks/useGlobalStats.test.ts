// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock schemas so Zod validation doesn't require exact data shape
vi.mock('@/lib/schemas', () => ({
  GlobalStatsSchema: { parse: (v: unknown) => v },
  HistoryApiResponseSchema: { parse: (v: unknown) => v },
}))

// Import after mock so the module picks up the stubbed schema
const { useGlobalStats } = await import('./useGlobalStats')

afterEach(() => {
  vi.restoreAllMocks()
})

const fakeStats = { characters: 200, gameStats: { winRate: 0.6 } }
const fakeHistory = { games: [], total: 5 }

describe('useGlobalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts loading, fetches both endpoints, resolves loading', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if ((url as string).includes('/api/v2/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeStats) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeHistory) })
    })

    const { result } = renderHook(() => useGlobalStats())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/stats'),
      expect.any(Object),
    )
  })

  it('sets error state when stats fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const { result } = renderHook(() => useGlobalStats())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.loading).toBe(false)
  })
})
