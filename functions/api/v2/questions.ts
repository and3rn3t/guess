import {
  type Env,
  jsonResponse,
  errorResponse,
  d1Query,
  d1First,
} from '../_helpers'

// ── Types ────────────────────────────────────────────────────

interface QuestionRow {
  id: string
  text: string
  attribute_key: string
  priority: number
}

interface QuestionWithCoverage extends QuestionRow {
  total_characters: number
  filled_count: number
  coverage_pct: number
}

// ── GET /api/v2/questions ────────────────────────────────────
// Returns all questions with optional attribute coverage stats

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const withCoverage = url.searchParams.get('coverage') === 'true'

  if (withCoverage) {
    // Join with character_attributes to compute coverage per question attribute
    const questions = await d1Query<QuestionWithCoverage>(
      db,
      `SELECT
        q.id, q.text, q.attribute_key, q.priority,
        tc.total_characters,
        COALESCE(cov.filled_count, 0) as filled_count,
        ROUND(
          CAST(COALESCE(cov.filled_count, 0) AS REAL)
          / MAX(tc.total_characters, 1) * 100, 1
        ) as coverage_pct
       FROM questions q
       CROSS JOIN (SELECT COUNT(*) as total_characters FROM characters) tc
       LEFT JOIN (
         SELECT attribute_key, COUNT(*) as filled_count
         FROM character_attributes
         WHERE value IS NOT NULL
         GROUP BY attribute_key
       ) cov ON cov.attribute_key = q.attribute_key
       ORDER BY q.priority DESC, q.id ASC`
    )
    return jsonResponse(questions)
  }

  const questions = await d1Query<QuestionRow>(
    db,
    'SELECT id, text, attribute_key, priority FROM questions ORDER BY priority DESC, id ASC'
  )
  return jsonResponse(questions)
}
