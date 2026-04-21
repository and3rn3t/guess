import {
  type Env,
  jsonResponse,
  errorResponse,
  d1Query,
} from '../_helpers'
import type { AttributeDefinitionsRow } from '../_db-types'

// ── Types ────────────────────────────────────────────────────

type AttributeDefRow = AttributeDefinitionsRow

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
        tc.total_characters,
        COALESCE(cov.filled_count, 0) as filled_count,
        COALESCE(cov.true_count, 0) as true_count,
        COALESCE(cov.false_count, 0) as false_count,
        tc.total_characters - COALESCE(cov.filled_count, 0) as null_count,
        ROUND(
          CAST(COALESCE(cov.filled_count, 0) AS REAL)
          / MAX(tc.total_characters, 1) * 100, 1
        ) as coverage_pct
       FROM attribute_definitions ad
       CROSS JOIN (SELECT COUNT(*) as total_characters FROM characters) tc
       LEFT JOIN (
         SELECT
           attribute_key,
           COUNT(*) as filled_count,
           SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) as true_count,
           SUM(CASE WHEN value = 0 THEN 1 ELSE 0 END) as false_count
         FROM character_attributes
         WHERE value IS NOT NULL
         GROUP BY attribute_key
       ) cov ON cov.attribute_key = ad.key
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
