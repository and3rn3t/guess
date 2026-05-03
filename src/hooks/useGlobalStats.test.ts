// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'

// Mock schemas so Zod validation doesn't require exact data shape
vi.mock('@/lib/schemas', () => ({
  GlobalStatsSchema: { parse: (v: unknown) => v },
  HistoryApiResponseSchema: { parse: (v: unknown) => v },
}))

let useGlobalStats: typeof import('./useGlobalStats').useGlobalStats

afterEach(() => {
  vi.restoreAllMocks()
})

const fakeStats = { characters: 200, gameStats: { winRate: 0.6 } }
const fakeHistory = { games: [], total: 5 }

describe('useGlobalStats', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    ;({ useGlobalStats } = await import('./useGlobalStats'))
  })

  it('starts loading, fetches both endpoints, resolves loading', async () => {
    server.use(
      http.get('/api/v2/stats', () => HttpResponse.json(fakeStats)),
      http.get('/api/v2/history', () => HttpResponse.json(fakeHistory)),
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const { result } = renderHook(() => useGlobalStats())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/stats'),
      expect.any(Object),
    )
  })

  it('sets error state when stats fetch fails', async () => {
    server.use(
      http.get('/api/v2/stats', () => new HttpResponse(null, { status: 500 })),
      http.get('/api/v2/history', () => HttpResponse.json(fakeHistory)),
    )

    const { result } = renderHook(() => useGlobalStats())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.loading).toBe(false)
  })
})
