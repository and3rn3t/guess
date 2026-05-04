import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  checkRateLimitDOMock,
  getCompletionsEndpointMock,
  getLlmHeadersMock,
  getOrCreateUserIdMock,
  withSetCookieMock,
  kvGetObjectMock,
  kvPutMock,
  sanitizeStringMock,
  logErrorMock,
  recordLLMUsageMock,
} = vi.hoisted(() => ({
  checkRateLimitDOMock: vi.fn(),
  getCompletionsEndpointMock: vi.fn(),
  getLlmHeadersMock: vi.fn(),
  getOrCreateUserIdMock: vi.fn(),
  withSetCookieMock: vi.fn(),
  kvGetObjectMock: vi.fn(),
  kvPutMock: vi.fn(),
  sanitizeStringMock: vi.fn(),
  logErrorMock: vi.fn(),
  recordLLMUsageMock: vi.fn(),
}))

vi.mock('./_helpers', () => ({
  checkRateLimitDO: checkRateLimitDOMock,
  getCompletionsEndpoint: getCompletionsEndpointMock,
  getLlmHeaders: getLlmHeadersMock,
  getOrCreateUserId: getOrCreateUserIdMock,
  withSetCookie: withSetCookieMock,
  kvGetObject: kvGetObjectMock,
  kvPut: kvPutMock,
  sanitizeString: sanitizeStringMock,
  logError: logErrorMock,
}))

vi.mock('./_llm_metrics', () => ({
  recordLLMUsage: recordLLMUsageMock,
}))

import { onRequestPost } from './llm'

function makeContext(body: Record<string, unknown>) {
  return {
    env: {
      OPENAI_API_KEY: 'test-key',
      GUESS_KV: {},
      GUESS_DB: {},
      GUESS_IMAGES: {},
      LLM_COSTS: {},
    },
    request: new Request('https://example.com/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    waitUntil: vi.fn(),
  } as unknown as Parameters<typeof onRequestPost>[0]
}

describe('POST /api/llm', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const cacheMatchMock = vi.fn()
  const cachePutMock = vi.fn()
  const setTimeoutMock = vi.spyOn(globalThis, 'setTimeout')

  beforeEach(() => {
    vi.clearAllMocks()

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('caches', {
      default: {
        match: cacheMatchMock,
        put: cachePutMock,
      },
    })

    setTimeoutMock.mockImplementation((((fn: TimerHandler) => {
      if (typeof fn === 'function') fn()
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as unknown) as typeof setTimeout)

    checkRateLimitDOMock.mockResolvedValue({ allowed: true, remaining: 59 })
    getCompletionsEndpointMock.mockReturnValue('https://gateway.example/v1/chat/completions')
    getLlmHeadersMock.mockReturnValue({ Authorization: 'Bearer test-key', 'Content-Type': 'application/json' })
    getOrCreateUserIdMock.mockResolvedValue({ userId: 'user-1', setCookieHeader: undefined })
    withSetCookieMock.mockImplementation((response: Response) => response)
    kvGetObjectMock.mockResolvedValue(null)
    kvPutMock.mockResolvedValue(undefined)
    sanitizeStringMock.mockImplementation((value: string) => value)
    logErrorMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns cache-hit response with retry count 0 and records HIT telemetry', async () => {
    cacheMatchMock.mockResolvedValue(new Response('cached-answer'))

    const response = await onRequestPost(makeContext({ prompt: 'who is this', model: 'gpt-4o-mini' }))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('cached-answer')
    expect(response.headers.get('X-Cache')).toBe('HIT')
    expect(response.headers.get('X-LLM-Retry-Count')).toBe('0')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(recordLLMUsageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cacheStatus: 'HIT', retryCount: 0, endpoint: 'llm' }),
    )
  })

  it('returns retry count after transient provider retry and records MISS telemetry', async () => {
    cacheMatchMock.mockResolvedValue(null)
    fetchMock
      .mockResolvedValueOnce(new Response('temporary', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'fresh-answer' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    const response = await onRequestPost(makeContext({ prompt: 'retry me', model: 'gpt-4o' }))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('fresh-answer')
    expect(response.headers.get('X-Cache')).toBe('MISS')
    expect(response.headers.get('X-LLM-Retry-Count')).toBe('1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(recordLLMUsageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cacheStatus: 'MISS', retryCount: 1, endpoint: 'llm' }),
    )
  })

  it('returns provider error on repeated 429s and logs once', async () => {
    cacheMatchMock.mockResolvedValue(null)
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }))

    const response = await onRequestPost(makeContext({ prompt: 'fail me', model: 'gpt-4o-mini' }))
    const body = await response.json() as { code: string }

    expect(response.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(logErrorMock).toHaveBeenCalled()
    expect(recordLLMUsageMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cacheStatus: 'MISS' }),
    )
  })
})
