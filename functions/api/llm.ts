/// <reference types="@cloudflare/workers-types" />

interface Env {
  OPENAI_API_KEY: string
}

const MAX_PROMPT_LENGTH = 50_000

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response('OPENAI_API_KEY not configured', { status: 500 })
  }

  let body: { prompt?: string; model?: string; jsonMode?: boolean }
  try {
    body = await context.request.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { prompt, model, jsonMode } = body

  if (!prompt || typeof prompt !== 'string') {
    return new Response('Missing or invalid "prompt" field', { status: 400 })
  }
  if (!model || typeof model !== 'string') {
    return new Response('Missing or invalid "model" field', { status: 400 })
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return new Response(`Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH}`, { status: 400 })
  }

  const allowedModels = ['gpt-4o', 'gpt-4o-mini']
  if (!allowedModels.includes(model)) {
    return new Response(`Model must be one of: ${allowedModels.join(', ')}`, { status: 400 })
  }

  try {
    const openaiBody: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }],
    }
    if (jsonMode) {
      openaiBody.response_format = { type: 'json_object' }
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text().catch(() => 'Unknown error')
      console.error('OpenAI API error:', openaiResponse.status, errorText)
      return new Response('LLM provider error', { status: 502 })
    }

    const data = (await openaiResponse.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return new Response('Empty response from LLM', { status: 502 })
    }

    return new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (error) {
    console.error('LLM proxy error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
