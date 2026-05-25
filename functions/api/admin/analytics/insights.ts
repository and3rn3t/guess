/**
 * POST /api/admin/analytics/insights — LLM-generated analytics insights.
 *
 * Accepts { summary, totalGames7d } body, returns AI insights text.
 * Cached 6h in KV.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../../_helpers'
import { d1CacheGet, d1CachePut } from '../../_d1_cache'

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

  const db = env.GUESS_DB
  const cacheKey = 'admin:analytics-insights'

  if (!bustCache) {
    const cached = await d1CacheGet<{ insights: string; generated_at: number }>(db, cacheKey)
    if (cached) return jsonResponse(cached)
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

  // AI.4 audit: this endpoint intentionally returns free-text prose (rendered
  // verbatim in the admin Insights card). json_object mode would force the
  // model to wrap the bullets in a JSON envelope we'd then strip — net loss.
  // Schema-mode is also unnecessary because the output is read by a human,
  // not parsed downstream.
  try {
    // AI.1: opt into AI Gateway upstream cache (6h, matches the D1 cache TTL
    // applied below). Deterministic prompt over read-only analytics rollups.
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env, 21600),
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

    await d1CachePut(db, cacheKey, result, 21600)

    return jsonResponse(result)
  } catch (e) {
    return errorResponse(`Insights failed: ${e instanceof Error ? e.message : 'Unknown'}`, 500)
  }
}
