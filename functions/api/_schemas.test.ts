import { describe, expect, it } from 'vitest'

import { ClientEventSchema } from './_schemas'

describe('ClientEventSchema', () => {
  const base = {
    id: '12345678-1234-1234-1234-123456789abc',
    clientTs: Date.now(),
  }

  it('accepts server_error events', () => {
    const result = ClientEventSchema.safeParse({
      ...base,
      eventType: 'server_error',
      data: { endpoint: '/api/v2/game/answer', status: 500, message: 'boom' },
    })

    expect(result.success).toBe(true)
  })

  it('accepts uncaught_error events', () => {
    const result = ClientEventSchema.safeParse({
      ...base,
      eventType: 'uncaught_error',
      data: { message: 'Unhandled rejection: network', stack: 'stack...' },
    })

    expect(result.success).toBe(true)
  })
})
