import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rephraseQuestion } from './_llm-rephrase'
import type { Env } from '../_helpers'
import type { ServerQuestion, ReasoningExplanation, Answer } from './_game-engine'

// ── Fixtures ──────────────────────────────────────────────────

const ENV: Env = {
  OPENAI_API_KEY: 'sk-test',
  GUESS_KV: {} as KVNamespace,
  GUESS_DB: {} as D1Database,
  GUESS_IMAGES: {} as R2Bucket,
}

const QUESTION: ServerQuestion = {
  id: 'q1',
  text: 'Is this character human?',
  attribute: 'isHuman',
}

const REASONING: ReasoningExplanation = {
  why: 'Splits evenly',
  impact: 'big impact',
  remaining: 50,
  confidence: 30,
  topCandidates: [
    { name: 'Mario', probability: 30, imageUrl: null },
    { name: 'Link', probability: 25, imageUrl: null },
  ],
}

const ANSWERS: Answer[] = [
  { questionId: 'canFly', value: 'no' },
]

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockLlmResponse(text: string, status = 200) {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ text }) } }],
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    ),
  )
}

beforeEach(() => {
  mockFetch.mockReset()
})

// ── Tests ─────────────────────────────────────────────────────

describe('rephraseQuestion', () => {
  it('returns null when no API key is configured', async () => {
    const envNoKey = { ...ENV, OPENAI_API_KEY: '' } as unknown as Env
    const result = await rephraseQuestion(envNoKey, QUESTION, [], REASONING, 1, 15)
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns the rephrased text on success', async () => {
    mockLlmResponse('Are they made of flesh and blood?')
    const result = await rephraseQuestion(ENV, QUESTION, ANSWERS, REASONING, 1, 15)
    expect(result).toBe('Are they made of flesh and blood?')
  })

  it('strips markdown code fences from the response', async () => {
    const fenced = '```json\n{"text":"Are they human?"}\n```'
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: fenced } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const result = await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    expect(result).toBe('Are they human?')
  })

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }))
    const result = await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    expect(result).toBeNull()
  })

  it('returns null when response JSON is malformed', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'not valid json' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const result = await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    expect(result).toBeNull()
  })

  it('returns null when rephrased text exceeds 150 chars', async () => {
    mockLlmResponse('x'.repeat(151))
    const result = await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    expect(result).toBeNull()
  })

  it('returns null when fetch throws (e.g. timeout/abort)', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
    const result = await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    expect(result).toBeNull()
  })

  it('returns null when choices array is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    )
    const result = await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    expect(result).toBeNull()
  })

  it('does NOT include candidateHint in the first half of the game', async () => {
    mockLlmResponse('Is this a living being?')
    await rephraseQuestion(ENV, QUESTION, [], REASONING, 3, 15) // progress = 3/15 = 0.2 < 0.5
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      messages: Array<{ role: string; content: string }>
    }
    const userMessage = body.messages.find((m) => m.role === 'user')!
    expect(userMessage.content).not.toContain('Top suspects')
  })

  it('DOES include candidateHint in the second half of the game', async () => {
    mockLlmResponse('Is this a living being?')
    await rephraseQuestion(ENV, QUESTION, [], REASONING, 9, 15) // progress = 9/15 = 0.6 >= 0.5
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      messages: Array<{ role: string; content: string }>
    }
    const userMessage = body.messages.find((m) => m.role === 'user')!
    expect(userMessage.content).toContain('Top suspects')
    expect(userMessage.content).toContain('Mario')
  })

  it('uses temperature 0.6', async () => {
    mockLlmResponse('A rephrased question')
    await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as { temperature: number }
    expect(body.temperature).toBe(0.6)
  })

  it('uses gpt-4o-mini model', async () => {
    mockLlmResponse('A rephrased question')
    await rephraseQuestion(ENV, QUESTION, [], REASONING, 1, 15)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as { model: string }
    expect(body.model).toBe('gpt-4o-mini')
  })

  it('includes recent answers in the user prompt', async () => {
    mockLlmResponse('A rephrased question')
    await rephraseQuestion(ENV, QUESTION, ANSWERS, REASONING, 5, 15)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      messages: Array<{ role: string; content: string }>
    }
    const userMessage = body.messages.find((m) => m.role === 'user')!
    expect(userMessage.content).toContain('canFly')
  })
})
