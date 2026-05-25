import { describe, expect, it } from 'vitest'

import { getLlmHeaders, internalErrorResponse, type Env } from './_helpers'

describe('internalErrorResponse', () => {
  it('returns a 500 JSON response', async () => {
    const res = internalErrorResponse('req-123')

    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(await res.json()).toEqual({
      error: 'Internal server error',
      requestId: 'req-123',
    })
  })

  it('preserves arbitrary request ids as-is', async () => {
    const res = internalErrorResponse('abc:def/ghi')

    expect(await res.json()).toEqual({
      error: 'Internal server error',
      requestId: 'abc:def/ghi',
    })
  })
})

describe('getLlmHeaders', () => {
  const baseEnv = { OPENAI_API_KEY: 'sk-test' } as unknown as Env

  it('emits OpenAI auth + content-type with no gateway extras by default', () => {
    const headers = getLlmHeaders(baseEnv)
    expect(headers.Authorization).toBe('Bearer sk-test')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['cf-aig-authorization']).toBeUndefined()
    expect(headers['cf-aig-cache-ttl']).toBeUndefined()
  })

  it('attaches cf-aig-authorization when both gateway vars are set', () => {
    const env = { ...baseEnv, CLOUDFLARE_AI_GATEWAY: 'https://gw.example/v1', AI_GATEWAY_TOKEN: 'gw-token' } as Env
    const headers = getLlmHeaders(env)
    expect(headers['cf-aig-authorization']).toBe('Bearer gw-token')
  })

  it('AI.1: emits cf-aig-cache-ttl when ttl > 0', () => {
    const headers = getLlmHeaders(baseEnv, 86400)
    expect(headers['cf-aig-cache-ttl']).toBe('86400')
  })

  it('AI.1: floors fractional ttl values', () => {
    const headers = getLlmHeaders(baseEnv, 60.9)
    expect(headers['cf-aig-cache-ttl']).toBe('60')
  })

  it('AI.1: omits cf-aig-cache-ttl when ttl is 0 or negative', () => {
    expect(getLlmHeaders(baseEnv, 0)['cf-aig-cache-ttl']).toBeUndefined()
    expect(getLlmHeaders(baseEnv, -1)['cf-aig-cache-ttl']).toBeUndefined()
  })
})
