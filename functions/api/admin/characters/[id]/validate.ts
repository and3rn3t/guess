/**
 * POST /api/admin/characters/:id/validate
 *
 * Validates a character's attribute set using LLM — finds contradictions,
 * suspicious nulls, and recommends fills.
 *
 * Calls OpenAI directly — NOT via /api/llm — so it bypasses the player rate limit.
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../../../_helpers'

export interface ValidationIssue {
  attributeKey: string
  type: 'contradiction' | 'suspicious-null' | 'recommended-fill'
  currentValue: boolean | null
  suggestedValue: boolean | null
  reason: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.OPENAI_API_KEY) return errorResponse('OpenAI not configured', 503)

  const id = context.params.id
  if (!id || typeof id !== 'string') return errorResponse('Missing character id', 400)

  let body: { name?: string; attributes?: Record<string, boolean | null> }
  try {
    body = await context.request.json() as { name?: string; attributes?: Record<string, boolean | null> }
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const characterName = body.name?.trim()
  const attributes = body.attributes

  if (!characterName || !attributes || typeof attributes !== 'object') {
    return errorResponse('name and attributes required', 400)
  }

  // Limit attribute entries to avoid huge prompts
  const attrEntries = Object.entries(attributes).slice(0, 120)
  const attrText = attrEntries
    .map(([k, v]) => `${k}: ${v === null ? 'null' : v}`)
    .join('\n')

  const prompt = `You are a fact-checker for a fictional character database. Review the attribute values for "${characterName}" and identify issues.

Attributes:
${attrText}

Find:
1. Contradictions: attribute pairs that cannot both be true for the same character
2. Suspicious nulls: attributes that should clearly be true or false for a character this well-known
3. Recommended fills: nulls that you can confidently fill based on widely-known facts

Return ONLY valid JSON:
{
  "issues": [
    {
      "attributeKey": "key_name",
      "type": "contradiction" | "suspicious-null" | "recommended-fill",
      "currentValue": true | false | null,
      "suggestedValue": true | false | null,
      "reason": "brief explanation"
    }
  ]
}

Limit to the 10 most important issues. If none found, return { "issues": [] }.`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      return errorResponse(`OpenAI error: ${response.status}`, 502)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { issues: ValidationIssue[] }

    return jsonResponse({ issues: parsed.issues ?? [] })
  } catch (e) {
    return errorResponse(`Validation failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 500)
  }
}
