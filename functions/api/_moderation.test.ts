import { describe, it, expect, vi } from 'vitest'
import { moderate } from './_moderation'
import type { Env } from './_helpers'

function makeEnv(aiResponse?: string | Error): Env {
  const ai = aiResponse === undefined
    ? undefined
    : {
        run: vi.fn().mockImplementation(() => {
          if (aiResponse instanceof Error) return Promise.reject(aiResponse)
          return Promise.resolve({ response: aiResponse })
        }),
      }
  return { AI: ai } as unknown as Env
}

describe('moderate (AI.6)', () => {
  it('passes through empty / whitespace input without calling AI', async () => {
    const env = makeEnv('unsafe\nS1')
    const result = await moderate(env, '   ')
    expect(result).toEqual({ allowed: true, reason: 'empty' })
    expect((env.AI as unknown as { run: ReturnType<typeof vi.fn> }).run).not.toHaveBeenCalled()
  })

  it('happy path: clean text + safe model response → allowed', async () => {
    const env = makeEnv('safe')
    const result = await moderate(env, 'Mario is a plumber from the Mushroom Kingdom')
    expect(result).toEqual({ allowed: true })
  })

  it('LDNOOBW fast-path: rejects synchronously without calling AI', async () => {
    const env = makeEnv('safe')
    const result = await moderate(env, 'some text with the word retard in it')
    expect(result).toEqual({ allowed: false, reason: 'ldnoobw' })
    expect((env.AI as unknown as { run: ReturnType<typeof vi.fn> }).run).not.toHaveBeenCalled()
  })

  it('Llama-Guard escalation: unsafe with S-codes returns reason with codes', async () => {
    const env = makeEnv('unsafe\nS1,S5')
    const result = await moderate(env, 'borderline content that needs LLM judgement')
    expect(result).toEqual({ allowed: false, reason: 'llama-guard:s1,s5' })
  })

  it('Llama-Guard escalation: unsafe with no codes line falls back to unspecified', async () => {
    const env = makeEnv('unsafe')
    const result = await moderate(env, 'borderline content that needs LLM judgement')
    expect(result).toEqual({ allowed: false, reason: 'llama-guard:unspecified' })
  })

  it('missing AI binding: fails open with diagnostic reason', async () => {
    const env = makeEnv(undefined)
    const result = await moderate(env, 'something the model would normally classify')
    expect(result).toEqual({ allowed: true, reason: 'ai-binding-missing' })
  })

  it('Llama-Guard call throws: fails open with error reason (graceful degradation)', async () => {
    const env = makeEnv(new Error('Workers AI overloaded'))
    const result = await moderate(env, 'something the model would normally classify')
    expect(result).toEqual({ allowed: true, reason: 'llama-guard-error' })
  })

  it('Llama-Guard returns empty response: treated as safe (defensive)', async () => {
    const env = makeEnv('')
    const result = await moderate(env, 'something innocuous')
    expect(result).toEqual({ allowed: true })
  })
})
