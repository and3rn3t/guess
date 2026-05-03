import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  d1RunMock,
  getOrCreateUserIdMock,
  parseJsonBodyMock,
  getRequestIdMock,
  logErrorMock,
  pickDailyCharacterMock,
  getDailyCompletionMock,
} = vi.hoisted(() => ({
  d1RunMock: vi.fn(),
  getOrCreateUserIdMock: vi.fn(),
  parseJsonBodyMock: vi.fn(),
  getRequestIdMock: vi.fn(() => 'req-daily-1'),
  logErrorMock: vi.fn().mockResolvedValue(undefined),
  pickDailyCharacterMock: vi.fn(),
  getDailyCompletionMock: vi.fn(),
}))

vi.mock('../../_helpers', () => ({
  d1Run: d1RunMock,
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
  parseJsonBody: parseJsonBodyMock,
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
  pickDailyCharacter: pickDailyCharacterMock,
  getDailyCompletion: getDailyCompletionMock,
}))

import { onRequestGet, onRequestPost } from './index'

function makeContext(method: 'GET' | 'POST', body?: unknown) {
  return {
    env: {
      GUESS_DB: {},
      GUESS_KV: {},
      COOKIE_SECRET: 'secret',
    },
    request: new Request('https://example.com/api/v2/daily', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
    waitUntil: vi.fn(),
  } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('GET /api/v2/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateUserIdMock.mockResolvedValue({ userId: 'user-12345678', setCookieHeader: undefined })
    pickDailyCharacterMock.mockResolvedValue({ id: 'mario', name: 'Mario', image_url: null })
    getDailyCompletionMock.mockResolvedValue(null)
  })

  it('returns daily status with completion=false when no prior result', async () => {
    const res = await onRequestGet(makeContext('GET'))
    const body = await res.json() as { date: string; characterId: string; completed: boolean }

    expect(res.status).toBe(200)
    expect(body.date).toBe('2026-05-02')
    expect(body.characterId).toBe('mario')
    expect(body.completed).toBe(false)
  })
})

describe('POST /api/v2/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateUserIdMock.mockResolvedValue({ userId: 'user-12345678', setCookieHeader: undefined })
    pickDailyCharacterMock.mockResolvedValue({ id: 'mario', name: 'Mario', image_url: null })
    parseJsonBodyMock.mockResolvedValue({ won: true, questionsAsked: 7 })
    d1RunMock.mockResolvedValue(undefined)
  })

  it('writes a completion row and returns ok payload', async () => {
    const res = await onRequestPost(makeContext('POST', { won: true, questionsAsked: 7 }))
    const body = await res.json() as { ok: boolean; date: string; characterId: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.characterId).toBe('mario')
    expect(d1RunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('INSERT OR IGNORE INTO daily_results'),
      ['2026-05-02', 'user-12345678', 'mario', 1, 7, expect.any(Number)],
    )
  })
})
