import { describe, expect, it } from 'vitest'

import { internalErrorResponse } from './_helpers'

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
