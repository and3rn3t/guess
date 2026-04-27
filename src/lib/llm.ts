import { LLM_MAX_RETRIES, LLM_NON_RETRYABLE_CODES, LLM_RETRYABLE_STATUSES, LLM_RETRY_BASE_MS } from './constants'
import { createHttpClient } from './http'
import { getUserId } from './utils'

const commonHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-User-Id': getUserId(),
})

export interface LlmOptions {
  prompt: string
  model: string
  jsonMode?: boolean
  systemPrompt?: string
  signal?: AbortSignal
}

export interface LlmResult {
  content: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  cached?: boolean
}

export class LlmError extends Error {
  code: string
  status: number
  retryable: boolean

  constructor(message: string, code: string, status: number, retryable: boolean) {
    super(message)
    this.name = 'LlmError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

async function parseErrorResponse(response: Response): Promise<LlmError> {
  let errorMsg = `LLM request failed (${response.status})`
  let code = 'UNKNOWN'

  try {
    const body = await response.json() as { error?: string; code?: string }
    if (body.error) errorMsg = body.error
    if (body.code) code = body.code
  } catch {
    const text = await response.text().catch(() => '')
    if (text) errorMsg = text
  }

  const retryable = LLM_RETRYABLE_STATUSES.has(response.status) && !LLM_NON_RETRYABLE_CODES.has(code)
  return new LlmError(errorMsg, code, response.status, retryable)
}

/** Wrap raw network/transport failures so callers see a friendly LlmError with code='NETWORK'. */
function wrapTransportError(err: unknown): never {
  if (err instanceof LlmError) throw err
  if (err instanceof TypeError) {
    throw new LlmError(
      'Network error — check your internet connection and try again.',
      'NETWORK',
      0,
      false,
    )
  }
  throw err
}

/** Retry-capable client for /api/llm. Retries on retryable LlmErrors and network errors. */
const llmJsonClient = createHttpClient({
  defaultHeaders: commonHeaders,
  parseError: parseErrorResponse,
  retry: {
    maxAttempts: LLM_MAX_RETRIES + 1,
    baseDelayMs: LLM_RETRY_BASE_MS,
    isRetryable: (err) => {
      if (err instanceof LlmError) return err.retryable
      return err instanceof TypeError
    },
  },
})

/** No-retry client for /api/llm-stream — partial streams can't be safely replayed. */
const llmStreamClient = createHttpClient({
  defaultHeaders: commonHeaders,
  parseError: parseErrorResponse,
})

/** Send a prompt to the LLM API and return the response text. */
export async function llm(prompt: string, model: string, jsonMode?: boolean): Promise<string> {
  const result = await llmWithMeta({ prompt, model, jsonMode })
  return result.content
}

/** Send a prompt to the LLM API with automatic retry (up to 2×) on transient failures. Returns content, token usage, and cache status. */
export async function llmWithMeta(options: LlmOptions): Promise<LlmResult> {
  let response: Response
  try {
    response = await llmJsonClient.requestOrThrow('/api/llm', {
      method: 'POST',
      signal: options.signal,
      body: JSON.stringify({
        prompt: options.prompt,
        model: options.model,
        jsonMode: options.jsonMode,
        systemPrompt: options.systemPrompt,
      }),
    })
  } catch (err) {
    wrapTransportError(err)
  }

  const content = await response.text()

  // Parse token usage from header
  let usage: LlmResult['usage']
  const usageHeader = response.headers.get('X-Token-Usage')
  if (usageHeader) {
    try {
      usage = JSON.parse(usageHeader)
    } catch {
      // Ignore malformed header
    }
  }

  const cached = response.headers.get('X-Cache') === 'HIT'

  return { content, usage, cached }
}

const SSE_DONE = Symbol('done')

/** Parse a single SSE line, returning the token string, SSE_DONE, or null to skip */
function parseSSEToken(line: string): string | typeof SSE_DONE | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null

  try {
    const data = JSON.parse(trimmed.slice(6)) as { token?: string; done?: boolean }
    if (data.done) return SSE_DONE
    if (data.token) return data.token
  } catch {
    // Skip malformed SSE data
  }
  return null
}

/** Stream LLM responses token by token via SSE */
export async function* llmStream(options: Omit<LlmOptions, 'jsonMode'>): AsyncGenerator<string> {
  let response: Response
  try {
    response = await llmStreamClient.requestOrThrow('/api/llm-stream', {
      method: 'POST',
      signal: options.signal,
      body: JSON.stringify({
        prompt: options.prompt,
        model: options.model,
        systemPrompt: options.systemPrompt,
      }),
    })
  } catch (err) {
    wrapTransportError(err)
  }

  if (!response.body) {
    throw new LlmError('Empty response stream', 'EMPTY_STREAM', 0, false)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const token = parseSSEToken(line)
        if (token === SSE_DONE) return
        if (token) yield token
      }
    }
  } finally {
    reader.releaseLock()
  }
}
