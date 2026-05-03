import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getActorIdMock,
  getRequestIdMock,
  checkRateLimitMock,
  getOrCreateUserIdMock,
  logErrorMock,
} = vi.hoisted(() => ({
  getActorIdMock: vi.fn(),
  getRequestIdMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getOrCreateUserIdMock: vi.fn(),
  logErrorMock: vi.fn(),
}))

vi.mock('./_helpers', () => ({
  getActorId: getActorIdMock,
  getRequestId: getRequestIdMock,
  checkRateLimit: checkRateLimitMock,
  internalErrorResponse: (requestId: string) =>
    new Response(JSON.stringify({ error: 'Internal server error', requestId }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }),
  jsonResponse: (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  errorResponse: (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  getOrCreateUserId: getOrCreateUserIdMock,
  logError: logErrorMock,
  withSetCookie: (response: Response, setCookieHeader?: string) => {
    if (!setCookieHeader) return response
    const next = new Response(response.body, response)
    next.headers.append('Set-Cookie', setCookieHeader)
    return next
  },
  withRequestId: (response: Response, requestId: string) => {
    const next = new Response(response.body, response)
    next.headers.set('X-Request-Id', requestId)
    return next
  },
}))

import { defineHandler, type HandlerCtx } from './_handler'

interface MockEnv {
  GUESS_KV: { get: () => Promise<null>; put: () => Promise<void> } | undefined
  GUESS_DB: { prepare: () => unknown } | undefined
}

function makeContext(env: Partial<MockEnv> = {}, request?: Request) {
  return {
    env: {
      GUESS_KV: 'GUESS_KV' in env ? env.GUESS_KV : { get: vi.fn(), put: vi.fn() },
      GUESS_DB: 'GUESS_DB' in env ? env.GUESS_DB : { prepare: vi.fn() },
    },
    request: request ?? new Request('https://example.com/api/test'),
    waitUntil: vi.fn(),
    params: {},
    data: {},
    next: vi.fn(),
    functionPath: '/api/test',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

beforeEach(() => {
  checkRateLimitMock.mockReset()
  getOrCreateUserIdMock.mockReset()
  getRequestIdMock.mockReset()
  getActorIdMock.mockReset()
  logErrorMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getOrCreateUserIdMock.mockResolvedValue({ userId: 'user-123' })
  getRequestIdMock.mockReturnValue('req-123')
  getActorIdMock.mockReturnValue('user:user-123')
})

describe('defineHandler', () => {
  it('returns 503 when KV missing and requireKv default', async () => {
    const handler = defineHandler({ name: 'test' }, async () =>
      new Response('ok'),
    )
    const res = await handler(makeContext({ GUESS_KV: undefined }))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'KV not configured' })
    expect(res.headers.get('X-Request-Id')).toBe('req-123')
  })

  it('skips KV check when requireKv: false', async () => {
    const handler = defineHandler(
      { name: 'test', requireKv: false, requireUser: false },
      async () => new Response('ok'),
    )
    const res = await handler(makeContext({ GUESS_KV: undefined }))
    expect(res.status).toBe(200)
  })

  it('passes ctx.userId from getOrCreateUserId', async () => {
    getOrCreateUserIdMock.mockResolvedValueOnce({ userId: 'abc-456' })
    let captured: HandlerCtx | undefined
    const handler = defineHandler({ name: 'test' }, async (ctx) => {
      captured = ctx
      return new Response('ok')
    })
    await handler(makeContext())
    expect(captured?.userId).toBe('abc-456')
  })

  it('does not call getOrCreateUserId when requireUser: false', async () => {
    const handler = defineHandler(
      { name: 'test', requireUser: false },
      async ({ userId }) => new Response(userId),
    )
    const res = await handler(makeContext())
    expect(getOrCreateUserIdMock).not.toHaveBeenCalled()
    expect(await res.text()).toBe('')
  })

  it('appends Set-Cookie when getOrCreateUserId returns one', async () => {
    getOrCreateUserIdMock.mockResolvedValueOnce({
      userId: 'new-user',
      setCookieHeader: '__gu_id=signed; Path=/',
    })
    const handler = defineHandler({ name: 'test' }, async () =>
      new Response('ok', { status: 200 }),
    )
    const res = await handler(makeContext())
    expect(res.headers.get('Set-Cookie')).toBe('__gu_id=signed; Path=/')
    expect(res.headers.get('X-Request-Id')).toBe('req-123')
  })

  it('always appends X-Request-Id header on success responses', async () => {
    const handler = defineHandler({ name: 'test' }, async () =>
      new Response('ok', { status: 200 }),
    )
    const res = await handler(makeContext())
    expect(res.headers.get('X-Request-Id')).toBe('req-123')
  })

  it('does not set cookie when no setCookieHeader returned', async () => {
    getOrCreateUserIdMock.mockResolvedValueOnce({ userId: 'existing' })
    const handler = defineHandler({ name: 'test' }, async () =>
      new Response('ok'),
    )
    const res = await handler(makeContext())
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0 })
    const handler = defineHandler(
      { name: 'test', rateLimit: 10 },
      async () => new Response('ok'),
    )
    const res = await handler(makeContext())
    expect(res.status).toBe(429)
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      'user-123',
      'test',
      10,
    )
  })

  it('skips rate limit when not configured', async () => {
    const handler = defineHandler({ name: 'test' }, async () =>
      new Response('ok'),
    )
    await handler(makeContext())
    expect(checkRateLimitMock).not.toHaveBeenCalled()
  })

  it('catches handler errors and returns 500 + logError', async () => {
    const handler = defineHandler({ name: 'test' }, async () => {
      throw new Error('boom')
    })
    const ctx = makeContext()
    const res = await handler(ctx)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error', requestId: 'req-123' })
    expect(ctx.waitUntil).toHaveBeenCalled()
    expect(logErrorMock).toHaveBeenCalledWith(
      ctx.env.GUESS_DB,
      'test',
      'error',
      'test handler error',
      expect.any(Error),
      {
        requestId: 'req-123',
        actorId: 'user:user-123',
        path: '/api/test',
        method: 'GET',
        status: 500,
      },
    )
    expect(res.headers.get('X-Request-Id')).toBe('req-123')
  })

  it('catches getOrCreateUserId failures (e.g. missing COOKIE_SECRET) as 500 + logError', async () => {
    getOrCreateUserIdMock.mockRejectedValueOnce(
      new Error('COOKIE_SECRET is not configured'),
    )
    const handler = defineHandler({ name: 'test' }, async () =>
      new Response('ok'),
    )
    const ctx = makeContext()
    const res = await handler(ctx)
    expect(res.status).toBe(500)
    expect(logErrorMock).toHaveBeenCalledWith(
      ctx.env.GUESS_DB,
      'test',
      'error',
      'test handler error',
      expect.any(Error),
      {
        requestId: 'req-123',
        actorId: 'user:user-123',
        path: '/api/test',
        method: 'GET',
        status: 500,
      },
    )
  })

  it('catches checkRateLimit failures (e.g. KV outage) as 500 + logError', async () => {
    checkRateLimitMock.mockRejectedValueOnce(new Error('KV unavailable'))
    const handler = defineHandler(
      { name: 'test', rateLimit: 10 },
      async () => new Response('ok'),
    )
    const ctx = makeContext()
    const res = await handler(ctx)
    expect(res.status).toBe(500)
    expect(logErrorMock).toHaveBeenCalledWith(
      ctx.env.GUESS_DB,
      'test',
      'error',
      'test handler error',
      expect.any(Error),
      {
        requestId: 'req-123',
        actorId: 'user:user-123',
        path: '/api/test',
        method: 'GET',
        status: 500,
      },
    )
  })

  it('appends Set-Cookie on rate-limited 429 response', async () => {
    getOrCreateUserIdMock.mockResolvedValueOnce({
      userId: 'fresh-user',
      setCookieHeader: '__gu_id=signed; Path=/',
    })
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0 })
    const handler = defineHandler(
      { name: 'test', rateLimit: 10 },
      async () => new Response('ok'),
    )
    const res = await handler(makeContext())
    expect(res.status).toBe(429)
    expect(res.headers.get('Set-Cookie')).toBe('__gu_id=signed; Path=/')
  })

  it('pre-parses url for the handler', async () => {
    let captured: URL | undefined
    const handler = defineHandler({ name: 'test' }, async (ctx) => {
      captured = ctx.url
      return new Response('ok')
    })
    await handler(
      makeContext({}, new Request('https://example.com/api/test?id=42')),
    )
    expect(captured?.searchParams.get('id')).toBe('42')
  })
})
