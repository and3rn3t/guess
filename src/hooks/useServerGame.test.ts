// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { GameAction } from '@/hooks/useGameState'
import { useServerGame } from './useServerGame'

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/sounds', () => ({
  playThinking: vi.fn(),
  playSuspense: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackGameStart: vi.fn(),
  trackGameEnd: vi.fn(),
  trackServerError: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const sessionStore: Record<string, string> = {}
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn((key: string) => sessionStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { sessionStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete sessionStore[key] }),
})

const dispatch = vi.fn<(action: GameAction) => void>()

beforeEach(() => {
  mockFetch.mockReset()
  dispatch.mockReset()
  vi.clearAllMocks()
  for (const key of Object.keys(sessionStore)) delete sessionStore[key]
})

describe('useServerGame', () => {
  it('initializes with null session ID and zero counts', () => {
    const { result } = renderHook(() => useServerGame(dispatch))
    expect(result.current.serverSessionId).toBeNull()
    expect(result.current.serverRemaining).toBe(0)
    expect(result.current.serverTotal).toBe(0)
  })

  describe('startServerGame', () => {
    it('starts a game and dispatches actions', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          sessionId: 'sess-123',
          question: { id: 'q1', text: 'Is human?', attribute: 'isHuman' },
          reasoning: { why: 'test', impact: '50%', remaining: 10, confidence: 50, topCandidates: [] },
          totalCharacters: 100,
        }),
        { status: 200 },
      ))

      const { result } = renderHook(() => useServerGame(dispatch))

      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_THINKING', isThinking: true })
      expect(dispatch).toHaveBeenCalledWith({ type: 'START_GAME', characters: [] })
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_QUESTION' }),
      )
      expect(result.current.serverSessionId).toBe('sess-123')
      expect(result.current.serverTotal).toBe(100)
    })

    it('handles start failure gracefully', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }))

      const { result } = renderHook(() => useServerGame(dispatch))

      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      expect(toast.error).toHaveBeenCalled()
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'NAVIGATE', phase: 'welcome' }),
      )
    })
  })

  describe('handleServerAnswer', () => {
    it('dispatches next question on question response', async () => {
      // First start a game to get a session ID
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          sessionId: 'sess-abc',
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: '', impact: '', remaining: 10, confidence: 0, topCandidates: [] },
          totalCharacters: 10,
        }),
        { status: 200 },
      ))

      const { result } = renderHook(() => useServerGame(dispatch))
      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      dispatch.mockClear()
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: 'question',
          question: { id: 'q2', text: 'Q2', attribute: 'canFly' },
          reasoning: { why: 'next', impact: '30%', remaining: 7, confidence: 30, topCandidates: [] },
          remaining: 7,
          readiness: {
            trigger: 'insufficient_data',
            blockedByRejectCooldown: false,
            rejectCooldownRemaining: 0,
            aliveCount: 7,
            questionsRemaining: 10,
          },
        }),
        { status: 200 },
      ))

      await act(async () => {
        await result.current.handleServerAnswer('yes')
      })

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_QUESTION' }),
      )
      expect(result.current.serverReadiness).toEqual(
        expect.objectContaining({
          trigger: 'insufficient_data',
          blockedByRejectCooldown: false,
          aliveCount: 7,
          questionsRemaining: 10,
        }),
      )
    })

    it('dispatches MAKE_GUESS on guess response', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          sessionId: 'sess-abc',
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: '', impact: '', remaining: 10, confidence: 0, topCandidates: [] },
          totalCharacters: 10,
        }),
        { status: 200 },
      ))

      const { result } = renderHook(() => useServerGame(dispatch))
      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      dispatch.mockClear()
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: 'guess',
          character: { id: 'mario', name: 'Mario', category: 'video-games', imageUrl: null },
          confidence: 95,
          remaining: 1,
        }),
        { status: 200 },
      ))

      await act(async () => {
        await result.current.handleServerAnswer('yes')
      })

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MAKE_GUESS' }),
      )
    })

    it('handles contradiction response', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          sessionId: 'sess-abc',
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: '', impact: '', remaining: 10, confidence: 0, topCandidates: [] },
          totalCharacters: 10,
        }),
        { status: 200 },
      ))

      const { result } = renderHook(() => useServerGame(dispatch))
      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      dispatch.mockClear()
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: 'contradiction',
          message: 'Contradictory answers',
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: '', impact: '', remaining: 10, confidence: 0, topCandidates: [] },
        }),
        { status: 200 },
      ))

      await act(async () => {
        await result.current.handleServerAnswer('yes')
      })

      expect(dispatch).toHaveBeenCalledWith({ type: 'UNDO_LAST_ANSWER' })
    })

    it('handles answer failure', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          sessionId: 'sess-abc',
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: '', impact: '', remaining: 10, confidence: 0, topCandidates: [] },
          totalCharacters: 10,
        }),
        { status: 200 },
      ))

      const { result } = renderHook(() => useServerGame(dispatch))
      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      dispatch.mockClear()
      vi.mocked(toast.error).mockClear()
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      await act(async () => {
        await result.current.handleServerAnswer('yes')
      })

      expect(toast.error).toHaveBeenCalled()
      expect(dispatch).toHaveBeenCalledWith({ type: 'UNDO_LAST_ANSWER' })
    })
  })

  describe('postServerResult', () => {
    it('posts result and clears session', async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          sessionId: 'sess-abc',
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: '', impact: '', remaining: 10, confidence: 0, topCandidates: [] },
          totalCharacters: 10,
        }),
        { status: 200 },
      ))

      const { result } = renderHook(() => useServerGame(dispatch))
      await act(async () => {
        await result.current.startServerGame([], 'medium')
      })

      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }))
      await act(async () => {
        result.current.postServerResult(true)
        // postServerResult defers the fetch via runWhenIdle (setTimeout fallback in jsdom)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(mockFetch).toHaveBeenLastCalledWith('/api/v2/game/result', expect.objectContaining({
        method: 'POST',
      }))
    })
  })

  describe('auto-resume', () => {
    it('resumes from saved session on mount', async () => {
      sessionStore['server-session-id'] = 'saved-sess'
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({
          expired: false,
          question: { id: 'q1', text: 'Q1', attribute: 'isHuman' },
          reasoning: { why: 'test', impact: '50%', remaining: 5, confidence: 50, topCandidates: [] },
          remaining: 5,
          totalCharacters: 10,
          questionCount: 3,
          answers: [],
        }),
        { status: 200 },
      ))

      renderHook(() => useServerGame(dispatch))

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith({ type: 'START_GAME', characters: [], guessCount: 0 })
      })
    })

    it('clears session on expired resume', async () => {
      sessionStore['server-session-id'] = 'expired-sess'
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ expired: true }),
        { status: 200 },
      ))

      renderHook(() => useServerGame(dispatch))

      await waitFor(() => {
        expect(sessionStore['server-session-id']).toBeUndefined()
      })
    })
  })
})
