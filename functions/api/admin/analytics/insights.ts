/**
 * POST /api/admin/analytics/insights — LLM-generated analytics insights.
 *
 * Accepts { summary, totalGames7d } body, returns AI insights text.
 * Cached 6h in KV.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../../_helpers'

interface EventSummaryItem {
  event_type: string
  count: number
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.OPENAI_API_KEY) return errorResponse('OpenAI not configured', 503)

  let body: { summary?: EventSummaryItem[]; totalGames7d?: number; bustCache?: boolean }
  try {
    body = await context.request.json() as typeof body
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { summary = [], totalGames7d = 0, bustCache = false } = body

  const kv = env.GUESS_ASSETS ?? null
  const cacheKey = 'admin:analytics-insights'

  if (!bustCache && kv) {
    const cached = await kv.get(cacheKey)
    if (cached) return jsonResponse(JSON.parse(cached))
  }

  const summaryText = summary
    .map((s) => `${s.event_type}: ${s.count.toLocaleString()} events`)
    .join('\n')

  const prompt = `You are analyzing player behavior data for a character-guessing game. Provide 3 specific, actionable insights.

Data (all-time event counts):
${summaryText || 'No events recorded yet.'}

Games played in last 7 days: ${totalGames7d}

Write 3 concise insights (1-2 sentences each) about:
1. Player engagement patterns
2. Any concerning drop-offs or funnel issues
3. One specific improvement suggestion

Be specific and data-driven. If there's insufficient data, say so briefly.`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 350,
      }),
    })

    if (!response.ok) return errorResponse(`OpenAI error: ${response.status}`, 502)

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const text = data.choices[0]?.message?.content?.trim() ?? ''

    const result = { insights: text, generated_at: Date.now() }

    if (kv) {
      await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 21600 })
    }

    return jsonResponse(result)
  } catch (e) {
    return errorResponse(`Insights failed: ${e instanceof Error ? e.message : 'Unknown'}`, 500)
  }
}
