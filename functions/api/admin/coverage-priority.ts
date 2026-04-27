/**
 * POST /api/admin/coverage-priority
 *
 * Returns the top sparse attributes ranked by discrimination impact.
 * Cached 6h in KV (`admin:coverage-priority`).
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, getCompletionsEndpoint, getLlmHeaders } from '../_helpers'

interface SparseAttr {
  key: string
  displayText: string
  nullPct: number
  coveragePct: number
}

export interface CoveragePriorityItem {
  key: string
  displayText: string
  nullPct: number
  reason: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.OPENAI_API_KEY) return errorResponse('OpenAI not configured', 503)

  const db = env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const kv = env.GUESS_ASSETS ?? null

  // Check KV cache first
  const cacheKey = 'admin:coverage-priority'
  if (kv) {
    const cached = await kv.get(cacheKey)
    if (cached) {
      return jsonResponse(JSON.parse(cached))
    }
  }

  // Query sparse attributes (high null %, at least 5 characters with known value)
  const rows = await db.prepare(`
    SELECT
      ad.key,
      ad.display_text AS displayText,
      ROUND(100.0 * SUM(CASE WHEN ca.value IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS nullPct,
      ROUND(100.0 * SUM(CASE WHEN ca.value IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS coveragePct
    FROM attribute_definitions ad
    JOIN characters c ON 1=1
    LEFT JOIN character_attributes ca ON ca.character_id = c.id AND ca.attribute_key = ad.key
    WHERE ad.is_active = 1
    GROUP BY ad.key
    HAVING nullPct > 30 AND COUNT(*) > 5
    ORDER BY nullPct DESC
    LIMIT 20
  `).all<SparseAttr>()

  const sparseAttrs = rows.results
  if (sparseAttrs.length === 0) {
    return jsonResponse({ items: [], generated_at: Date.now() })
  }

  const attrText = sparseAttrs
    .map((a) => `- ${a.key} (${a.nullPct}% null): "${a.displayText}"`)
    .join('\n')

  const prompt = `You are analyzing a character-guessing game's attribute database. The following attributes have high null rates (missing data for many characters).

Sparse attributes (null%):
${attrText}

Rank the top 5 that would most improve the game if enriched. Consider:
1. Discrimination power (does knowing this split characters effectively?)
2. Breadth (applies to many character types: games, movies, anime, books)
3. Player experience (would players want to ask this question?)

Return ONLY valid JSON:
{
  "items": [
    {
      "key": "attribute_key",
      "displayText": "same as input",
      "nullPct": same number,
      "reason": "1 sentence explaining why this is high priority"
    }
  ]
}`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      return errorResponse(`OpenAI error: ${response.status}`, 502)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { items: CoveragePriorityItem[] }

    const result = {
      items: (parsed.items ?? []).slice(0, 5),
      generated_at: Date.now(),
    }

    // Cache for 6h
    if (kv) {
      await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 21600 })
    }

    return jsonResponse(result)
  } catch (e) {
    return errorResponse(`Priority analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 500)
  }
}
