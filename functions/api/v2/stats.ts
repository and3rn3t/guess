import {
  type Env,
  jsonResponse,
  errorResponse,
  d1Query,
  d1First,
} from '../_helpers'

// ── GET /api/v2/stats ────────────────────────────────────────
// Database overview: character/attribute/question counts

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const [characters, attributes, questions, byCategory, bySource] = await Promise.all([
    d1First<{ count: number }>(db, 'SELECT COUNT(*) as count FROM characters'),
    d1First<{ count: number }>(db, 'SELECT COUNT(*) as count FROM attribute_definitions'),
    d1First<{ count: number }>(db, 'SELECT COUNT(*) as count FROM questions'),
    d1Query<{ category: string; count: number }>(
      db,
      'SELECT category, COUNT(*) as count FROM characters GROUP BY category ORDER BY count DESC'
    ),
    d1Query<{ source: string; count: number }>(
      db,
      'SELECT source, COUNT(*) as count FROM characters GROUP BY source ORDER BY count DESC'
    ),
  ])

  const totalAttrs = await d1First<{ total: number; filled: number }>(
    db,
    `SELECT
       COUNT(*) as total,
       COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as filled
     FROM character_attributes`
  )

  return jsonResponse({
    characters: characters?.count ?? 0,
    attributes: attributes?.count ?? 0,
    questions: questions?.count ?? 0,
    characterAttributes: {
      total: totalAttrs?.total ?? 0,
      filled: totalAttrs?.filled ?? 0,
      fillRate: totalAttrs?.total
        ? Math.round(((totalAttrs.filled ?? 0) / totalAttrs.total) * 1000) / 10
        : 0,
    },
    byCategory,
    bySource,
  })
}
