import { describe, it, expect } from 'vitest'
import { buildEnv, invokeHandler, mockOpenAi } from './harness'
import { onRequestPost } from '../recommender'

describe('POST /api/admin/recommender', () => {
  it('returns validated recommendations from OpenAI JSON', async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        recommendations: [
          {
            attribute: 'isHero',
            label: 'Hero',
            reason: 'Core identity trait',
            priority: 'high',
          },
          {
            attribute: 'canFly',
            label: 'Can Fly',
            reason: 'Known movement ability',
            priority: 'medium',
          },
        ],
      }),
    })

    try {
      const res = await invokeHandler<{ recommendations: Array<{ attribute: string }> }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ openaiKey: 'test-key' }),
        body: {
          characterName: 'Superman',
          existingAttributes: { isFictional: true },
          availableAttributes: [
            { key: 'isHero', label: 'Hero' },
            { key: 'canFly', label: 'Can Fly' },
          ],
          maxRecommendations: 5,
          focusDescription: 'General traits',
        },
      })

      expect(res.status).toBe(200)
      expect(res.body.recommendations).toHaveLength(2)
      expect(res.body.recommendations[0]?.attribute).toBe('isHero')
      expect(stub.calls[0]?.url).toContain('/chat/completions')
    } finally {
      stub.restore()
    }
  })

  it('returns 400 for invalid request body', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv({ openaiKey: 'test-key' }),
      body: {
        characterName: '',
        existingAttributes: {},
        availableAttributes: [],
      },
    })

    expect(res.status).toBe(400)
  })

  it('returns 503 when OpenAI key is missing', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv(),
      body: {
        characterName: 'Batman',
        existingAttributes: {},
        availableAttributes: [{ key: 'isHero', label: 'Hero' }],
      },
    })

    expect(res.status).toBe(503)
  })
})
