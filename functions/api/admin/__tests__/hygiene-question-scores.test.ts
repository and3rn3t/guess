import { describe, it, expect } from 'vitest'
import { buildEnv, invokeHandler, mockOpenAi } from './harness'
import { onRequestPost } from '../hygiene-question-scores'

describe('POST /api/admin/hygiene-question-scores', () => {
  it('returns validated scores for requested questions', async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        scores: [
          {
            questionId: 'q-1',
            clarity: 5,
            power: 4,
            grammar: 4,
          },
          {
            questionId: 'other-id',
            clarity: 1,
            power: 1,
            grammar: 1,
          },
        ],
      }),
    })

    try {
      const res = await invokeHandler<{ scores: Array<{ questionId: string }> }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ openaiKey: 'test-key' }),
        body: {
          questions: [
            { id: 'q-1', text: 'Is this character a hero?', attribute: 'isHero' },
          ],
        },
      })

      expect(res.status).toBe(200)
      expect(res.body.scores).toHaveLength(1)
      expect(res.body.scores[0]?.questionId).toBe('q-1')
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
        questions: [],
      },
    })

    expect(res.status).toBe(400)
  })

  it('returns 503 when OpenAI key is missing', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv(),
      body: {
        questions: [
          { id: 'q-1', text: 'Is this character a hero?', attribute: 'isHero' },
        ],
      },
    })

    expect(res.status).toBe(503)
  })
})