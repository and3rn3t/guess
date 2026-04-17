const USER_ID_KEY = 'kv:user-id'

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

function commonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
  }
}

export interface LlmOptions {
  prompt: string
  model: string
  jsonMode?: boolean
  systemPrompt?: string
}

export interface LlmResult {
  content: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  cached?: boolean
}

export async function llm(prompt: string, model: string, jsonMode?: boolean): Promise<string> {
  const result = await llmWithMeta({ prompt, model, jsonMode })
  return result.content
}

export async function llmWithMeta(options: LlmOptions): Promise<LlmResult> {
  let response: Response
  try {
    response = await fetch('/api/llm', {
      method: 'POST',
      headers: commonHeaders(),
      body: JSON.stringify({
        prompt: options.prompt,
        model: options.model,
        jsonMode: options.jsonMode,
        systemPrompt: options.systemPrompt,
      }),
    })
  } catch {
    throw new Error('Network error — check your internet connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error('The AI service is temporarily unavailable. Please try again in a moment.')
    }
    if (response.status === 429) {
      throw new Error('Too many requests — please wait a moment and try again.')
    }
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM request failed (${response.status}): ${errorText}`)
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
  const response = await fetch('/api/llm-stream', {
    method: 'POST',
    headers: commonHeaders(),
    body: JSON.stringify({
      prompt: options.prompt,
      model: options.model,
      systemPrompt: options.systemPrompt,
    }),
  })

  if (!response.ok) {
    throw new Error(`Stream request failed (${response.status})`)
  }

  const reader = response.body!.getReader()
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
