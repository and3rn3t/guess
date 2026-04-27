import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LlmError } from './llm'

// We test llmWithMeta, llm, and llmStream by mocking global fetch.
// The module reads from localStorage for user ID, so we mock that too.

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })

// Override retry delay to 0 so tests run fast
vi.mock('./constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./constants')>()
  return { ...actual, LLM_RETRY_BASE_MS: 0 }
})

beforeEach(() => {
  vi.resetModules()
  mockFetch.mockReset()
  for (const key of Object.keys(store)) delete store[key]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LlmError', () => {
  it('has correct properties', () => {
    const err = new LlmError('Rate limited', 'RATE_LIMIT', 429, true)
    expect(err.message).toBe('Rate limited')
    expect(err.code).toBe('RATE_LIMIT')
    expect(err.status).toBe(429)
    expect(err.retryable).toBe(true)
    expect(err.name).toBe('LlmError')
    expect(err).toBeInstanceOf(Error)
  })

  it('can be non-retryable', () => {
    const err = new LlmError('Forbidden', 'FORBIDDEN', 403, false)
    expect(err.retryable).toBe(false)
  })
})

describe('llm (simple wrapper)', () => {
  it('returns content string on success', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Hello World', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))

    const { llm } = await import('./llm')
    const result = await llm('test prompt', 'gpt-4o')
    expect(result).toBe('Hello World')
  })
})

describe('llmWithMeta', () => {
  it('returns content, usage, and cache status', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Response text', {
      status: 200,
      headers: {
        'X-Token-Usage': JSON.stringify({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }),
        'X-Cache': 'HIT',
      },
    }))

    const { llmWithMeta } = await import('./llm')
    const result = await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })
    expect(result.content).toBe('Response text')
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })
    expect(result.cached).toBe(true)
  })

  it('sends correct request body and headers', async () => {
    mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const { llmWithMeta } = await import('./llm')
    await llmWithMeta({ prompt: 'test prompt', model: 'gpt-4o-mini', jsonMode: true, systemPrompt: 'Be helpful' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/llm')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-User-Id')).toBeTruthy()

    const body = JSON.parse(init.body)
    expect(body.prompt).toBe('test prompt')
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.jsonMode).toBe(true)
    expect(body.systemPrompt).toBe('Be helpful')
  })

  it('retries on 429 status', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }))
      .mockResolvedValueOnce(new Response('Success', { status: 200 }))

    const { llmWithMeta } = await import('./llm')
    const result = await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })
    expect(result.content).toBe('Success')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on 502 status', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }))

    const { llmWithMeta } = await import('./llm')
    const result = await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })
    expect(result.content).toBe('OK')
  })

  it('retries on network error', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }))

    const { llmWithMeta } = await import('./llm')
    const result = await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })
    expect(result.content).toBe('OK')
  })

  it('throws after max retries', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))

    const { llmWithMeta } = await import('./llm')
    await expect(llmWithMeta({ prompt: 'test', model: 'gpt-4o' })).rejects.toThrow()
  })

  it('does not retry non-retryable status codes', async () => {
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403 },
    ))

    const { llmWithMeta } = await import('./llm')
    await expect(llmWithMeta({ prompt: 'test', model: 'gpt-4o' })).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('does not retry QUOTA_EXCEEDED even on 429', async () => {
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' }),
      { status: 429 },
    ))

    const { llmWithMeta } = await import('./llm')
    await expect(llmWithMeta({ prompt: 'test', model: 'gpt-4o' })).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('handles missing usage header gracefully', async () => {
    mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }))

    const { llmWithMeta } = await import('./llm')
    const result = await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })
    expect(result.usage).toBeUndefined()
    expect(result.cached).toBe(false)
  })

  it('handles malformed usage header gracefully', async () => {
    mockFetch.mockResolvedValueOnce(new Response('OK', {
      status: 200,
      headers: { 'X-Token-Usage': 'not-json' },
    }))

    const { llmWithMeta } = await import('./llm')
    const result = await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })
    expect(result.usage).toBeUndefined()
  })

  it('generates userId and persists to localStorage', async () => {
    mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }))

    const { llmWithMeta } = await import('./llm')
    await llmWithMeta({ prompt: 'test', model: 'gpt-4o' })

    const userId = new Headers(mockFetch.mock.calls[0][1].headers).get('X-User-Id')
    expect(userId).toBeTruthy()
  })
})

describe('llmStream', () => {
  it('yields tokens from SSE stream', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"token":"Hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"token":" World"}\n\n'))
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'))
        controller.close()
      },
    })

    mockFetch.mockResolvedValueOnce(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))

    const { llmStream } = await import('./llm')
    const tokens: string[] = []
    for await (const token of llmStream({ prompt: 'test', model: 'gpt-4o' })) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['Hello', ' World'])
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ error: 'Bad request' }),
      { status: 400 },
    ))

    const { llmStream } = await import('./llm')
    await expect(async () => {
      for await (const _ of llmStream({ prompt: 'test', model: 'gpt-4o' })) {
        // consume
      }
    }).rejects.toThrow()
  })

  it('throws on empty body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const { llmStream } = await import('./llm')
    await expect(async () => {
      for await (const _ of llmStream({ prompt: 'test', model: 'gpt-4o' })) {
        // consume
      }
    }).rejects.toThrow()
  })

  it('skips malformed SSE lines', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: not-json\n\n'))
        controller.enqueue(encoder.encode('data: {"token":"valid"}\n\n'))
        controller.enqueue(encoder.encode(': comment line\n\n'))
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'))
        controller.close()
      },
    })

    mockFetch.mockResolvedValueOnce(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))

    const { llmStream } = await import('./llm')
    const tokens: string[] = []
    for await (const token of llmStream({ prompt: 'test', model: 'gpt-4o' })) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['valid'])
  })
})
