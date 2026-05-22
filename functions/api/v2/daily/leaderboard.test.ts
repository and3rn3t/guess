import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  d1QueryMock,
  getOrCreateUserIdMock,
  getRequestIdMock,
  logErrorMock,
} = vi.hoisted(() => ({
  d1QueryMock: vi.fn(),
  getOrCreateUserIdMock: vi.fn(),
  getRequestIdMock: vi.fn(() => 'req-daily-lb-1'),
  logErrorMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../_helpers', () => ({
  d1Query: d1QueryMock,
  errorResponse: (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } }),
  getOrCreateUserId: getOrCreateUserIdMock,
  getRequestId: getRequestIdMock,
  internalErrorResponse: (requestId: string) =>
    new Response(JSON.stringify({ error: 'Internal server error', requestId }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }),
  jsonResponse: (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  withRequestId: (response: Response, requestId: string) => {
    const next = new Response(response.body, response)
    next.headers.set('X-Request-Id', requestId)
    return next
  },
  withSetCookie: (response: Response, setCookieHeader?: string) => {
    if (!setCookieHeader) return response
    const next = new Response(response.body, response)
    next.headers.append('Set-Cookie', setCookieHeader)
    return next
  },
  logError: logErrorMock,
}))

vi.mock('./_shared', () => ({
  getUtcDateKey: () => '2026-05-02',
  toUserLabel: (userId: string) => `Player ${userId.slice(0, 8)}`,
}))

import { onRequestGet } from './leaderboard'

function makeContext(url = 'https://example.com/api/v2/daily/leaderboard') {
  return {
    env: {
      GUESS_DB: {},
      COOKIE_SECRET: 'secret',
    },
    request: new Request(url, { method: 'GET' }),
    waitUntil: vi.fn(),
  } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('GET /api/v2/daily/leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateUserIdMock.mockResolvedValue({ userId: 'user-12345678', setCookieHeader: undefined })
    d1QueryMock.mockResolvedValue([
      { user_id: 'user-12345678', won: 1, questions_asked: 6, completed_at: 1_746_000_001_000 },
      { user_id: 'user-abcdef12', won: 1, questions_asked: 7, completed_at: 1_746_000_002_000 },
    ])
  })

  it('returns leaderboard rows with rank and isYou flag', async () => {
    const res = await onRequestGet(makeContext())
    const body = await res.json() as {
      date: string
      leaderboard: Array<{ rank: number; isYou: boolean; userLabel: string; questionsAsked: number }>
    }

    expect(res.status).toBe(200)
    expect(body.date).toBe('2026-05-02')
    expect(body.leaderboard).toHaveLength(2)
    expect(body.leaderboard[0]).toMatchObject({ rank: 1, isYou: true, userLabel: 'Player user-123' })
    expect(body.leaderboard[1]).toMatchObject({ rank: 2, isYou: false, questionsAsked: 7 })
  })

  it('returns 400 for an invalid date parameter', async () => {
    const res = await onRequestGet(makeContext('https://example.com/api/v2/daily/leaderboard?date=bad-date'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid limit parameter', async () => {
    const res = await onRequestGet(makeContext('https://example.com/api/v2/daily/leaderboard?limit=999'))
    expect(res.status).toBe(400)
  })

  it('forwards a valid limit parameter to D1 query', async () => {
    await onRequestGet(makeContext('https://example.com/api/v2/daily/leaderboard?date=2026-05-01&limit=30'))

    expect(d1QueryMock).toHaveBeenCalledTimes(1)
    const queryArgs = d1QueryMock.mock.calls[0]?.[2] as unknown[]
    expect(queryArgs).toEqual(['2026-05-01', 30])
  })
})
