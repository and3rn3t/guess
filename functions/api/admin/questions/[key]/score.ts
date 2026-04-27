/**
 * POST /api/admin/questions/:key/score
 *
 * Runs LLM quality scoring on a question's display text + question text.
 * Returns { clarity, power, grammar } scores (1–5 each) and optional rewrite.
 *
 * Calls OpenAI directly — NOT via /api/llm — so it bypasses the player rate limit.
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../../../_helpers'

interface ScoreResult {
  clarity: number
  power: number
  grammar: number
  rewrite?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.OPENAI_API_KEY) return errorResponse('OpenAI not configured', 503)

  const key = context.params.key
  if (!key || typeof key !== 'string') return errorResponse('Missing question key', 400)

  let body: { displayText?: string; questionText?: string }
  try {
    body = await context.request.json() as { displayText?: string; questionText?: string }
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const displayText = body.displayText?.trim() ?? ''
  const questionText = body.questionText?.trim() ?? ''

  if (!displayText && !questionText) {
    return errorResponse('displayText or questionText required', 400)
  }

  const textToScore = questionText || displayText

  const prompt = `Rate this yes/no question for a character guessing game on three dimensions (1–5 each):
- Clarity: Is the question unambiguous and well-defined?
- Discriminative power: Does it effectively split the character space (not too broad, not too niche)?
- Grammar/naturalness: Does it sound natural when spoken aloud?

Attribute key: ${key}
Display text: "${displayText}"
Question text: "${textToScore}"

If any score < 3, provide a rewrite that improves the weakest dimension.

Return ONLY valid JSON: { "clarity": 1-5, "power": 1-5, "grammar": 1-5, "rewrite": "optional improved question" }`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return errorResponse(`OpenAI error: ${errText.slice(0, 200)}`, 502)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    const content = data.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as ScoreResult

    const result: ScoreResult = {
      clarity: Math.min(5, Math.max(1, Math.round(parsed.clarity))),
      power: Math.min(5, Math.max(1, Math.round(parsed.power))),
      grammar: Math.min(5, Math.max(1, Math.round(parsed.grammar))),
      rewrite: parsed.rewrite ?? undefined,
    }

    return jsonResponse(result)
  } catch (e) {
    return errorResponse(`Score failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 500)
  }
}
