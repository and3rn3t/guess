/**
 * GET  /api/admin/characters   — paginated character list with coverage stats
 *
 * ⚡ Optimizations:
 *    - totalAttributes cached in KV (24hr TTL, changes rarely)
 *    - maxCoverage filter pushed to SQL WHERE clause (fixes pagination)
 *    - count query includes coverage filter for accurate pagination
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

/**
 * Fetch total active attributes, using KV cache (24hr TTL).
 * This value changes infrequently, so caching reduces DB load significantly.
 */
async function getTotalAttributesCached(
  db: D1Database,
  kv: KVNamespace | undefined,
): Promise<number> {
  const cacheKey = 'admin:total-attributes'

  // Try KV cache first
  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached) {
        const value = parseInt(cached, 10)
        if (!Number.isNaN(value)) return value
      }
    } catch (err) {
      console.error('KV cache read failed:', err)
    }
  }

  try {
    const result = await db
      .prepare('SELECT COUNT(*) as total FROM attribute_definitions WHERE is_active = 1')
      .first<{ total: number }>()
    const total = result?.total ?? 1

    // Cache for 24 hours
    if (kv) {
      try {
        await kv.put(cacheKey, String(total), { expirationTtl: 86400 })
      } catch (err) {
        console.error('KV cache write failed:', err)
      }
    }

    return total
  } catch (err) {
    console.error('Failed to fetch total attributes:', err)
    return 1 // Safe default
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const search = url.searchParams.get('search') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const maxCoverageParam = url.searchParams.get('maxCoverage')
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize
  const sortBy = url.searchParams.get('sort') ?? 'popularity'
  const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'

  // Fetch total attributes (cached)
  const totalAttributes = await getTotalAttributesCached(db, kv)

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

  // Push maxCoverage filter to SQL WHERE clause
  // maxCoverage is a percentage, so convert: coverage% = (attribute_count / totalAttributes) * 100
  // Filter: (attribute_count / totalAttributes) * 100 <= maxCoverage
  // Which is: attribute_count <= (maxCoverage / 100 * totalAttributes)
  const maxCoverage = maxCoverageParam !== null && maxCoverageParam !== '' 
    ? parseInt(maxCoverageParam, 10) 
    : null
  if (maxCoverage !== null && !Number.isNaN(maxCoverage) && maxCoverage >= 0 && maxCoverage <= 100) {
    const attrThreshold = Math.round((maxCoverage / 100) * totalAttributes)
    conditions.push('c.attribute_count <= ?')
    params.push(attrThreshold)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const validSortColumns: Record<string, string> = {
    popularity: 'c.popularity',
    name: 'c.name',
    coverage: 'c.attribute_count',
    createdAt: 'c.created_at',
    // "Needs Work" = high popularity but low coverage (popularity * 0.6 + coverageGap * 0.4)
    needsWork: '(c.popularity * 0.6 + ((100 - ROUND(c.attribute_count * 100.0 / ?)) * 0.4))',
    // "Recently Added" = newest first
    recentlyAdded: 'c.created_at',
  }
  
  // For "Needs Work" sort, we need totalAttributes as a parameter
  const sortCol = validSortColumns[sortBy] ?? 'c.popularity'
  const sortParams = [...params]
  if (sortBy === 'needsWork') {
    sortParams.push(totalAttributes) // Add totalAttributes param for the needs work calculation
  }

  // Fetch count and rows in parallel
  const [countResult, rows] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as total FROM characters c ${where}`)
      .bind(...params)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT
        c.id, c.name, c.category, c.source, c.popularity,
        c.image_url, c.attribute_count, c.is_custom, c.created_at
      FROM characters c
      ${where}
      ORDER BY ${sortCol} ${order}
      LIMIT ? OFFSET ?`
      )
      .bind(...sortParams, pageSize, offset)
      .all<CharactersRow & { attribute_count: number }>(),
  ])

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
