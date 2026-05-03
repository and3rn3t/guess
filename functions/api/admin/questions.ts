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
  difficulty: string | null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const search = url.searchParams.get('search') ?? ''
  const active = url.searchParams.get('active') ?? 'all'
  const difficulty = url.searchParams.get('difficulty') ?? 'all'
  const textStatus = url.searchParams.get('textStatus') ?? 'all'
  const minUsageParam = url.searchParams.get('minUsage')
  const sort = url.searchParams.get('sort') ?? 'usage'
  const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize

  const minUsageRaw = minUsageParam !== null && minUsageParam !== ''
    ? parseInt(minUsageParam, 10)
    : 0
  const minUsage = Number.isNaN(minUsageRaw) ? 0 : Math.max(0, minUsageRaw)

  const whereConditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    const searchParam = `%${search}%`
    whereConditions.push('(ad.key LIKE ? OR ad.display_text LIKE ? OR ad.question_text LIKE ?)')
    params.push(searchParam, searchParam, searchParam)
  }

  if (active === 'active') {
    whereConditions.push('ad.is_active = 1')
  } else if (active === 'inactive') {
    whereConditions.push('ad.is_active = 0')
  }

  if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
    whereConditions.push('q.difficulty = ?')
    params.push(difficulty)
  } else if (difficulty === 'unset') {
    whereConditions.push('q.difficulty IS NULL')
  }

  if (textStatus === 'missing') {
    whereConditions.push('(ad.question_text IS NULL OR TRIM(ad.question_text) = \'\')')
  } else if (textStatus === 'present') {
    whereConditions.push('(ad.question_text IS NOT NULL AND TRIM(ad.question_text) != \'\')')
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  const sortColumns: Record<string, string> = {
    usage: 'usage_count',
    key: 'key',
    difficulty: "COALESCE(difficulty, 'zzzz')",
    createdAt: 'created_at',
    active: 'is_active',
  }
  const sortColumn = sortColumns[sort] ?? 'usage_count'

  const usageCte = `
    WITH usage AS (
      SELECT
        ad.key,
        ad.display_text,
        ad.question_text,
        ad.categories,
        ad.is_active,
        ad.created_at,
        q.difficulty,
        COUNT(DISTINCT gs.id) as usage_count
      FROM attribute_definitions ad
      LEFT JOIN questions q ON q.attribute_key = ad.key
      LEFT JOIN game_stats gs ON gs.answer_distribution IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM json_each(gs.answer_distribution) jk WHERE jk.key = ad.key
        )
      ${whereClause}
      GROUP BY ad.key, ad.display_text, ad.question_text, ad.categories, ad.is_active, ad.created_at, q.difficulty
    )
  `

  const countResult = await db
    .prepare(`${usageCte} SELECT COUNT(*) as total FROM usage WHERE usage_count >= ?`)
    .bind(...params, minUsage)
    .first<{ total: number }>()

  const rows = await db
    .prepare(
      `${usageCte}
      SELECT
        key,
        display_text,
        question_text,
        categories,
        is_active,
        created_at,
        usage_count,
        difficulty
      FROM usage
      WHERE usage_count >= ?
      ORDER BY ${sortColumn} ${order}, key ASC
      LIMIT ? OFFSET ?`
    )
    .bind(...params, minUsage, pageSize, offset)
    .all<AttributeDefinitionsRow & { usage_count: number; difficulty: string | null }>()

  const questions: AdminQuestion[] = (rows.results ?? []).map((r) => ({
    key: r.key,
    displayText: r.display_text,
    questionText: r.question_text,
    categories: r.categories,
    isActive: r.is_active !== 0,
    createdAt: r.created_at,
    usageCount: r.usage_count,
    difficulty: r.difficulty ?? null,
  }))

  return jsonResponse({
    questions,
    total: countResult?.total ?? 0,
    page,
    pageSize,
  })
}
