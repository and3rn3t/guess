/**
 * GET  /api/admin/characters   — paginated character list with coverage stats
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 * PATCH /api/admin/characters/:id and DELETE /api/admin/characters/:id
 * are in functions/api/admin/characters/[id].ts
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import type { CharactersRow } from '../_db-types'

export interface AdminCharacter {
  id: string
  name: string
  category: string
  source: string
  popularity: number
  imageUrl: string | null
  attributeCount: number
  totalAttributes: number
  coveragePct: number
  isCustom: boolean
  createdAt: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const search = url.searchParams.get('search') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize
  const sortBy = url.searchParams.get('sort') ?? 'popularity'
  const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('c.name LIKE ?')
    params.push(`%${search}%`)
  }
  if (category) {
    conditions.push('c.category = ?')
    params.push(category)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const validSortColumns: Record<string, string> = {
    popularity: 'c.popularity',
    name: 'c.name',
    coverage: 'c.attribute_count',
    createdAt: 'c.created_at',
  }
  const sortCol = validSortColumns[sortBy] ?? 'c.popularity'

  const [countResult, totalAttrsResult] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as total FROM characters c ${where}`)
      .bind(...params)
      .first<{ total: number }>(),
    db
      .prepare('SELECT COUNT(*) as total FROM attribute_definitions WHERE is_active = 1')
      .first<{ total: number }>(),
  ])

  const rows = await db
    .prepare(
      `SELECT
        c.id, c.name, c.category, c.source, c.popularity,
        c.image_url, c.attribute_count, c.is_custom, c.created_at
      FROM characters c
      ${where}
      ORDER BY ${sortCol} ${order}
      LIMIT ? OFFSET ?`
    )
    .bind(...params, pageSize, offset)
    .all<CharactersRow & { attribute_count: number }>()

  const totalAttributes = totalAttrsResult?.total ?? 1

  const characters: AdminCharacter[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    source: r.source,
    popularity: r.popularity,
    imageUrl: r.image_url,
    attributeCount: r.attribute_count ?? 0,
    totalAttributes,
    coveragePct: totalAttributes > 0 ? Math.round(((r.attribute_count ?? 0) / totalAttributes) * 100) : 0,
    isCustom: r.is_custom === 1,
    createdAt: r.created_at,
  }))

  return jsonResponse({
    characters,
    total: countResult?.total ?? 0,
    page,
    pageSize,
  })
}
