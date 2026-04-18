import {
  type Env,
  jsonResponse,
  errorResponse,
  d1Query,
  d1First,
} from '../_helpers'

// ── Types ────────────────────────────────────────────────────

interface AttributeDefRow {
  key: string
  display_text: string
  question_text: string | null
  categories: string | null
  created_at: number
}

interface AttributeCoverage {
  key: string
  display_text: string
  total_characters: number
  filled_count: number
  true_count: number
  false_count: number
  null_count: number
  coverage_pct: number
}

// ── GET /api/v2/attributes ───────────────────────────────────
// List attribute definitions, optionally with coverage stats

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const withCoverage = url.searchParams.get('coverage') === 'true'

  if (withCoverage) {
    const attrs = await d1Query<AttributeCoverage>(
      db,
      `SELECT
        ad.key,
        ad.display_text,
        (SELECT COUNT(*) FROM characters) as total_characters,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value IS NOT NULL) as filled_count,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value = 1) as true_count,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value = 0) as false_count,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value IS NULL) as null_count,
        ROUND(
          CAST((SELECT COUNT(*) FROM character_attributes ca
                WHERE ca.attribute_key = ad.key AND ca.value IS NOT NULL) AS REAL)
          / MAX((SELECT COUNT(*) FROM characters), 1) * 100, 1
        ) as coverage_pct
       FROM attribute_definitions ad
       ORDER BY ad.key ASC`
    )
    return jsonResponse(attrs)
  }

  const attrs = await d1Query<AttributeDefRow>(
    db,
    'SELECT key, display_text, question_text, categories, created_at FROM attribute_definitions ORDER BY key ASC'
  )
  return jsonResponse(attrs)
}
