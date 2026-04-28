import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  d1RunMock,
  deleteSessionMock,
  getBestGuessMock,
  loadSessionMock,
  getOrCreateUserIdMock,
} = vi.hoisted(() => ({
  d1RunMock: vi.fn(),
  deleteSessionMock: vi.fn(),
  getBestGuessMock: vi.fn(),
  loadSessionMock: vi.fn(),
  getOrCreateUserIdMock: vi.fn(),
}))

vi.mock('../../_helpers', () => ({
  d1Run: d1RunMock,
  errorResponse: (message: string, status: number) => new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }),
  getOrCreateUserId: getOrCreateUserIdMock,
  jsonResponse: (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }),
  parseJsonBody: async <T>(request: Request) => request.json() as Promise<T>,
  parseJsonBodyWithSchema: async <T>(request: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown } }) => {
    const raw = await request.json()
    const result = schema.safeParse(raw)
    if (!result.success) {
      return { success: false, response: new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 }) }
    }
    return { success: true, data: result.data }
  },
  withSetCookie: (response: Response, setCookieHeader?: string) => {
    if (!setCookieHeader) return response
    const nextResponse = new Response(response.body, response)
    nextResponse.headers.append('Set-Cookie', setCookieHeader)
    return nextResponse
  },
}))

vi.mock('../_game-engine', () => ({
  deleteSession: deleteSessionMock,
  getBestGuess: getBestGuessMock,
  loadSession: loadSessionMock,
}))

import { onRequestPost } from './result'

describe('POST /api/v2/game/result', () => {
  beforeEach(() => {
    d1RunMock.mockReset()
    deleteSessionMock.mockReset()
    getBestGuessMock.mockReset()
    loadSessionMock.mockReset()
    getOrCreateUserIdMock.mockReset()

    d1RunMock.mockResolvedValue({ success: true })
    deleteSessionMock.mockResolvedValue(undefined)
    getOrCreateUserIdMock.mockResolvedValue({
      userId: 'user-123',
      setCookieHeader: 'test-cookie=1; Path=/',
    })
  })

  it('persists guess readiness analytics into game_stats and schedules session completion backup', async () => {
    const sessionId = '12345678-1234-1234-1234-000000000123'
    loadSessionMock.mockResolvedValue({
      id: sessionId,
      characters: [
        {
          id: 'mario',
          name: 'Mario',
          category: 'video-games',
          imageUrl: null,
          attributes: { isHuman: true },
        },
      ],
      questions: [
        { id: 'q1', text: 'Are they human?', attribute: 'isHuman' },
      ],
      answers: [
        { questionId: 'isHuman', value: 'yes' },
      ],
      currentQuestion: null,
      difficulty: 'medium',
      maxQuestions: 15,
      createdAt: 1,
      rejectedGuesses: ['luigi'],
      guessCount: 2,
      postRejectCooldown: 0,
      guessAnalytics: {
        confidence: 0.88,
        entropy: 0.29,
        remaining: 3,
        answerDistribution: { yes: 1, no: 0, maybe: 0, unknown: 0 },
        trigger: 'strict_readiness',
        forced: false,
        gap: 0.41,
        aliveCount: 2,
        questionsRemaining: 4,
      },
    })
    getBestGuessMock.mockReturnValue({ id: 'mario', name: 'Mario' })

    const waitUntil = vi.fn()
    const response = await onRequestPost({
      env: {
        GUESS_DB: {} as D1Database,
        GUESS_KV: {} as KVNamespace,
      },
      request: new Request('https://example.com/api/v2/game/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, correct: true }),
      }),
      waitUntil,
    } as unknown as Parameters<typeof onRequestPost>[0])

    expect(response.status).toBe(200)
    expect(deleteSessionMock).toHaveBeenCalledWith(expect.anything(), sessionId)
    expect(d1RunMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.stringContaining('INSERT INTO game_stats'),
      [
        'user-123',
        1,
        'medium',
        1,
        1,
        'mario',
        'Mario',
        JSON.stringify([
          {
            questionText: 'Are they human?',
            attribute: 'isHuman',
            answer: 'yes',
          },
        ]),
        2,
        0.88,
        0.29,
        3,
        JSON.stringify({ yes: 1, no: 0, maybe: 0, unknown: 0 }),
        'strict_readiness',
        0,
        0.41,
        2,
        4,
        expect.any(Number),
      ]
    )
    expect(d1RunMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'UPDATE game_sessions SET completed_at = ?, dropped_at_phase = NULL WHERE id = ?',
      [expect.any(Number), sessionId]
    )
    expect(waitUntil).toHaveBeenCalledTimes(2)
  })
})