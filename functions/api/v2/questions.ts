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
        (SELECT COUNT(*) FROM characters) as total_characters,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = q.attribute_key AND ca.value IS NOT NULL) as filled_count,
        ROUND(
          CAST((SELECT COUNT(*) FROM character_attributes ca
                WHERE ca.attribute_key = q.attribute_key AND ca.value IS NOT NULL) AS REAL)
          / MAX((SELECT COUNT(*) FROM characters), 1) * 100, 1
        ) as coverage_pct
       FROM questions q
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
