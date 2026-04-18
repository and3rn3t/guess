import {
  type Env,
  getUserId,
  checkRateLimit,
  sanitizeString,
} from './_helpers'

const MAX_PROMPT_LENGTH = 50_000
const ALLOWED_MODELS = ['gpt-4o', 'gpt-4o-mini']

/** Parse a single SSE line from OpenAI into a client-facing SSE chunk, or null to skip */
function parseSSELine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed?.startsWith('data: ')) return null

  const data = trimmed.slice(6)
  if (data === '[DONE]') return 'data: {"done":true}\n\n'

  try {
    const parsed = JSON.parse(data) as {
      choices: Array<{ delta: { content?: string } }>
    }
    const token = parsed.choices?.[0]?.delta?.content
    if (token) return `data: ${JSON.stringify({ token })}\n\n`
  } catch {
    // Skip malformed chunks
  }
  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'LLM not configured', code: 'NO_API_KEY' }, { status: 500 })
  }

  const kv = context.env.GUESS_KV

  let body: { prompt?: string; model?: string; systemPrompt?: string }
  try {
    body = await context.request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, model, systemPrompt } = body

  if (!prompt || typeof prompt !== 'string') {
    return Response.json({ error: 'Missing or invalid "prompt"' }, { status: 400 })
  }
  if (!model || typeof model !== 'string') {
    return Response.json({ error: 'Missing or invalid "model"' }, { status: 400 })
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: 'Prompt too long' }, { status: 400 })
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return Response.json({ error: `Model must be one of: ${ALLOWED_MODELS.join(', ')}` }, { status: 400 })
  }

  // Rate limiting (shares budget with /api/llm)
  if (kv) {
    const userId = getUserId(context.request)
    const { allowed } = await checkRateLimit(kv, userId, 'llm', 60)
    if (!allowed) {
    return Response.json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }, { status: 429 })
    }
  }

  // Build messages
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt && typeof systemPrompt === 'string') {
    messages.push({ role: 'system', content: sanitizeString(systemPrompt) })
  }
  messages.push({ role: 'user', content: prompt })

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text().catch(() => 'Unknown error')
      console.error('OpenAI stream error:', openaiResponse.status, errorText)

      if (openaiResponse.status === 429) {
        const isQuota = errorText.includes('insufficient_quota')
        return Response.json(
          {
            error: isQuota
              ? 'API quota exceeded — please check billing'
              : 'Rate limited by LLM provider',
            code: isQuota ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED',
          },
          { status: 429 },
        )
      }

      return Response.json(
        { error: 'LLM provider error', code: 'PROVIDER_ERROR' },
        { status: 502 },
      )
    }

    // Pipe OpenAI SSE stream to client as our own SSE stream
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    const processStream = async () => {
      const body = openaiResponse.body
      if (!body) return
      const reader = body.getReader()
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
            const chunk = parseSSELine(line)
            if (!chunk) continue
            await writer.write(encoder.encode(chunk))
          }
        }
      } catch (err) {
        console.error('Stream processing error:', err)
      } finally {
        await writer.close()
      }
    }

    // Don't await — let it run in background
    context.waitUntil(processStream())

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('LLM stream error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
