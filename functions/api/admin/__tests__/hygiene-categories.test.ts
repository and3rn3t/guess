import { describe, it, expect } from 'vitest'
import { buildEnv, invokeHandler, mockOpenAi } from './harness'
import { onRequestPost } from '../hygiene-categories'

describe('POST /api/admin/hygiene-categories', () => {
  it('returns a validated category suggestion', async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        suggestedCategory: 'movies',
        confidence: 0.92,
        reasoning: 'The character is primarily known from films',
      }),
    })

    try {
      const res = await invokeHandler<{
        suggestion: null | { suggestedCategory: string }
      }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ openaiKey: 'test-key' }),
        body: {
          characterId: 'batman',
          characterName: 'Batman',
          currentCategory: 'comics',
          attributes: { isHero: true },
        },
      })

      expect(res.status).toBe(200)
      expect(res.body.suggestion?.suggestedCategory).toBe('movies')
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
        characterId: '',
        characterName: '',
        currentCategory: 'invalid-category',
        attributes: {},
      },
    })

    expect(res.status).toBe(400)
  })

  it('returns 503 when OpenAI key is missing', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv(),
      body: {
        characterId: 'goku',
        characterName: 'Goku',
        currentCategory: 'anime',
        attributes: { canFly: true },
      },
    })

    expect(res.status).toBe(503)
  })
})