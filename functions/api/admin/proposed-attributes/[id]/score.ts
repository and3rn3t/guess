/**
 * POST /api/admin/proposed-attributes/:id/score
 *
 * Scores a proposed attribute for quality — returns 0-100 score + concerns list.
 *
 * Calls OpenAI directly — NOT via /api/llm.
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../../../_helpers'

export interface ProposalScore {
  score: number
  concerns: string[]
  strengths: string[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.OPENAI_API_KEY) return errorResponse('OpenAI not configured', 503)

  let body: {
    key?: string
    displayText?: string
    questionText?: string
    rationale?: string
  }
  try {
    body = await context.request.json() as typeof body
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { key, displayText, questionText, rationale } = body

  if (!key || !displayText || !questionText) {
    return errorResponse('key, displayText, and questionText required', 400)
  }

  const prompt = `You are a quality gate for a character-guessing game. Score this proposed attribute on a 0-100 scale.

Proposed attribute:
- Key: "${key}"
- Display text: "${displayText}"
- Question: "${questionText}"
- Rationale: "${rationale ?? 'not provided'}"

Evaluation criteria:
1. Discriminative power: Does it split characters into roughly equal yes/no groups?
2. Universal applicability: Can it be answered for most fictional characters?
3. Unambiguity: Is the question clear with a definitive yes/no answer?
4. Novelty: Does it cover something not obvious from name/appearance?
5. Grammar: Is the question well-formed?

Return ONLY valid JSON:
{
  "score": 0-100,
  "concerns": ["list of specific issues"],
  "strengths": ["list of strengths"]
}

If no concerns/strengths, use empty arrays.`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      return errorResponse(`OpenAI error: ${response.status}`, 502)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as ProposalScore

    const result: ProposalScore = {
      score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0))),
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    }

    return jsonResponse(result)
  } catch (e) {
    return errorResponse(`Scoring failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 500)
  }
}
