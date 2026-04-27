/**
 * POST /api/admin/attribute-disputes-ai?id=N
 *
 * Runs LLM arbitration on a single open dispute.
 * Uses correctionJudge_v1 rubric: returns "current" | "flagged" verdict + confidence + reason.
 *
 * Calls OpenAI directly — NOT via /api/llm.
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../_helpers'

export interface DisputeAiVerdict {
  correct: 'current' | 'flagged'
  confidence: number
  reason: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.OPENAI_API_KEY) return errorResponse('OpenAI not configured', 503)

  let body: {
    characterName?: string
    attributeKey?: string
    currentValue?: boolean | null
    disputeReason?: string
    confidence?: number
  }
  try {
    body = await context.request.json() as typeof body
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { characterName, attributeKey, currentValue, disputeReason } = body

  if (!characterName || !attributeKey) {
    return errorResponse('characterName and attributeKey required', 400)
  }

  const flaggedValue = currentValue === true ? false : currentValue === false ? true : null

  const prompt = `You are a fact-checker for a fictional character database. Assess which attribute value is most likely correct based on widely-known canonical facts.

Character: "${characterName}"
Attribute: "${attributeKey}"
Current database value: ${currentValue === null ? 'null (unknown)' : String(currentValue)}
Dispute reason: "${disputeReason ?? '(not provided)'}"
Disputed correction (the other value): ${flaggedValue === null ? 'null (unknown)' : String(flaggedValue)}

Which value is more likely correct for "${characterName}"? Use canonical, widely-known facts only.

Return ONLY valid JSON: { "correct": "current" | "flagged", "confidence": 0.0-1.0, "reason": "brief explanation (1-2 sentences)" }`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      return errorResponse(`OpenAI error: ${response.status}`, 502)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as DisputeAiVerdict

    const verdict: DisputeAiVerdict = {
      correct: parsed.correct === 'current' || parsed.correct === 'flagged' ? parsed.correct : 'current',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason ?? ''),
    }

    return jsonResponse(verdict)
  } catch (e) {
    return errorResponse(`AI review failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 500)
  }
}
