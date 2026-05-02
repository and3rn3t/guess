import { describe, it, expect } from 'vitest'
import { buildEnv, invokeHandler, mockOpenAi } from './harness'
import { onRequestPost } from '../hygiene-attributes'

describe('POST /api/admin/hygiene-attributes', () => {
  it('returns validated attribute issues', async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        issues: [
          {
            attribute: 'isVillain',
            currentValue: true,
            suggestedValue: false,
            reason: 'Character is primarily framed as a hero',
            type: 'likely-incorrect',
          },
          {
            attribute: 'notInInput',
            currentValue: true,
            suggestedValue: false,
            reason: 'Should be filtered out',
          },
        ],
      }),
    })

    try {
      const res = await invokeHandler<{ issues: Array<{ attribute: string }> }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ openaiKey: 'test-key' }),
        body: {
          characterId: 'superman',
          characterName: 'Superman',
          attributes: {
            isHero: true,
            isVillain: true,
          },
        },
      })

      expect(res.status).toBe(200)
      expect(res.body.issues).toHaveLength(1)
      expect(res.body.issues[0]?.attribute).toBe('isVillain')
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
        characterId: '',
        characterName: '',
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
        characterId: 'batman',
        characterName: 'Batman',
        attributes: {
          isHero: true,
        },
      },
    })

    expect(res.status).toBe(503)
  })
})