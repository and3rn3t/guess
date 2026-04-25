/**
 * GET  /api/admin/questions  — list attribute_definitions with usage stats
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 * PATCH /api/admin/questions/:key is in functions/api/admin/questions/[key].ts
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import type { AttributeDefinitionsRow } from '../_db-types'

export interface AdminQuestion {
  key: string
  displayText: string
  questionText: string | null
  categories: string | null
  isActive: boolean
  createdAt: number
  usageCount: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const search = url.searchParams.get('search') ?? ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize

  const whereClause = search ? `WHERE (ad.key LIKE ? OR ad.display_text LIKE ? OR ad.question_text LIKE ?)` : ''
  const searchParam = `%${search}%`
  const params: (string | number)[] = search ? [searchParam, searchParam, searchParam] : []

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM attribute_definitions ad ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>()

  const rows = await db
    .prepare(
      `SELECT
        ad.key,
        ad.display_text,
        ad.question_text,
        ad.categories,
        ad.is_active,
        ad.created_at,
        COUNT(DISTINCT gs.id) as usage_count
      FROM attribute_definitions ad
      LEFT JOIN game_stats gs ON gs.answer_distribution IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM json_each(gs.answer_distribution) jk WHERE jk.key = ad.key
        )
      ${whereClause}
      GROUP BY ad.key
      ORDER BY usage_count DESC, ad.key ASC
      LIMIT ? OFFSET ?`
    )
    .bind(...params, pageSize, offset)
    .all<AttributeDefinitionsRow & { usage_count: number }>()

  const questions: AdminQuestion[] = (rows.results ?? []).map((r) => ({
    key: r.key,
    displayText: r.display_text,
    questionText: r.question_text,
    categories: r.categories,
    isActive: r.is_active !== 0,
    createdAt: r.created_at,
    usageCount: r.usage_count,
  }))

  return jsonResponse({
    questions,
    total: countResult?.total ?? 0,
    page,
    pageSize,
  })
}
