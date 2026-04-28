// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuestionCoverage } from './useQuestionCoverage'

const mockRows = [
  { id: 'q1', text: 'Is human?', attribute_key: 'isHuman', priority: 1, total_characters: 100, filled_count: 80, coverage_pct: 0.8 },
]

describe('useQuestionCoverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null data and loading false when disabled', () => {
    globalThis.fetch = vi.fn()
    const { result } = renderHook(() => useQuestionCoverage(false))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('fetches when enabled becomes true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    })

    const { result } = renderHook(() => useQuestionCoverage(true))
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(mockRows)
  })

  it('resolves to empty array on fetch error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const { result } = renderHook(() => useQuestionCoverage(true))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('does not re-fetch once data is loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    })

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useQuestionCoverage(enabled),
      { initialProps: { enabled: true } },
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const callCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    rerender({ enabled: true })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount)
  })
})
