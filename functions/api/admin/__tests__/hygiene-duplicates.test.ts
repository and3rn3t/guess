import { describe, it, expect } from 'vitest'
import { buildEnv, invokeHandler, mockOpenAi } from './harness'
import { onRequestPost } from '../hygiene-duplicates'

describe('POST /api/admin/hygiene-duplicates', () => {
  it('returns duplicate decision with canonical id', async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        isDuplicate: true,
        canonicalId: 'batman',
        reason: 'Same canonical identity label',
      }),
    })

    try {
      const res = await invokeHandler<{
        isDuplicate: boolean
        canonicalId?: string
      }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ openaiKey: 'test-key' }),
        body: {
          a: { id: 'batman', name: 'Batman' },
          b: { id: 'dc-batman', name: 'Batman' },
        },
      })

      expect(res.status).toBe(200)
      expect(res.body.isDuplicate).toBe(true)
      expect(res.body.canonicalId).toBe('batman')
      expect(stub.calls[0]?.url).toContain('/chat/completions')
    } finally {
      stub.restore()
    }
  })

  it('returns 400 for invalid body', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv({ openaiKey: 'test-key' }),
      body: {
        a: { id: '', name: '' },
      },
    })

    expect(res.status).toBe(400)
  })

  it('returns 503 when OpenAI key is missing', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv(),
      body: {
        a: { id: 'superman', name: 'Superman' },
        b: { id: 'clark-kent', name: 'Clark Kent' },
      },
    })

    expect(res.status).toBe(503)
  })
})