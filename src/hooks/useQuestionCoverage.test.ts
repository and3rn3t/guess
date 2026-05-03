// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { useQuestionCoverage } from './useQuestionCoverage'

const mockRows = [
  { id: 'q1', text: 'Is human?', attribute_key: 'isHuman', priority: 1, total_characters: 100, filled_count: 80, coverage_pct: 0.8 },
]

describe('useQuestionCoverage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null data and loading false when disabled', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useQuestionCoverage(false))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches when enabled becomes true', async () => {
    server.use(
      http.get('/api/v2/questions', () => HttpResponse.json(mockRows)),
    )

    const { result } = renderHook(() => useQuestionCoverage(true))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(mockRows)
  })

  it('resolves to empty array on fetch error', async () => {
    server.use(
      http.get('/api/v2/questions', () => new HttpResponse(null, { status: 500 })),
    )

    const { result } = renderHook(() => useQuestionCoverage(true))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('does not re-fetch once data is loaded', async () => {
    server.use(
      http.get('/api/v2/questions', () => HttpResponse.json(mockRows)),
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useQuestionCoverage(enabled),
      { initialProps: { enabled: true } },
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    const callCount = fetchSpy.mock.calls.length
    rerender({ enabled: true })

    await waitFor(() => expect(fetchSpy.mock.calls.length).toBe(callCount))

    expect(fetchSpy.mock.calls.length).toBe(callCount)
  })
})
