/**
 * GET /api/admin/coverage
 *
 * Server-side attribute coverage aggregation over all enriched characters.
 * Eliminates the client-side 50-character limit by computing stats in D1.
 *
 * Query params:
 *   category  — filter to a single character category (optional)
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

interface AttributeCoverageRow {
  key: string
  display_text: string
  true_count: number
  false_count: number
  null_count: number
  defined_count: number
}

export interface AdminCoverageAttribute {
  key: string
  displayText: string
  trueCount: number
  falseCount: number
  nullCount: number
  definedCount: number
  missingCount: number
  coveragePct: number
  diversityScore: number
}

export interface AdminCoverageResponse {
  totalEnriched: number
  totalActive: number
  category: string | null
  attributes: AdminCoverageAttribute[]
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const category = url.searchParams.get('category') || null

  const validCategories = new Set([
    'video-games', 'movies', 'anime', 'comics', 'books', 'cartoons', 'tv-shows', 'pop-culture',
  ])
  if (category && !validCategories.has(category)) {
    return errorResponse('Invalid category', 400)
  }

  const categoryFilter = category ? 'AND c.category = ?' : ''
  const categoryParam = category ? [category] : []

  const [totalResult, attrRows] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as total FROM characters WHERE attribute_count > 0 ${categoryFilter}`)
      .bind(...categoryParam)
      .first<{ total: number }>(),

    category
      ? db
          .prepare(
            `SELECT
              ad.key,
              ad.display_text,
              SUM(CASE WHEN ca.value = 1 THEN 1 ELSE 0 END) as true_count,
              SUM(CASE WHEN ca.value = 0 THEN 1 ELSE 0 END) as false_count,
              SUM(CASE WHEN ca.value IS NULL THEN 1 ELSE 0 END) as null_count,
              COUNT(ca.character_id) as defined_count
            FROM attribute_definitions ad
            LEFT JOIN (
              SELECT ca.attribute_key, ca.value, ca.character_id
              FROM character_attributes ca
              INNER JOIN characters c ON c.id = ca.character_id
              WHERE c.category = ?
            ) ca ON ca.attribute_key = ad.key
            WHERE ad.is_active = 1
            GROUP BY ad.key, ad.display_text
            ORDER BY ad.key ASC`
          )
          .bind(category)
          .all<AttributeCoverageRow>()
      : db
          .prepare(
            `SELECT
              ad.key,
              ad.display_text,
              SUM(CASE WHEN ca.value = 1 THEN 1 ELSE 0 END) as true_count,
              SUM(CASE WHEN ca.value = 0 THEN 1 ELSE 0 END) as false_count,
              SUM(CASE WHEN ca.value IS NULL THEN 1 ELSE 0 END) as null_count,
              COUNT(ca.character_id) as defined_count
            FROM attribute_definitions ad
            LEFT JOIN character_attributes ca ON ca.attribute_key = ad.key
            WHERE ad.is_active = 1
            GROUP BY ad.key, ad.display_text
            ORDER BY ad.key ASC`
          )
          .all<AttributeCoverageRow>(),
  ])

  const totalEnriched = totalResult?.total ?? 0

  const attributes: AdminCoverageAttribute[] = (attrRows.results ?? []).map((row) => {
    const trueCount = row.true_count ?? 0
    const falseCount = row.false_count ?? 0
    const nullCount = row.null_count ?? 0
    const definedCount = row.defined_count ?? 0
    const missingCount = Math.max(0, totalEnriched - definedCount)
    const coveredCount = trueCount + falseCount
    const coveragePct = totalEnriched > 0
      ? Math.round((coveredCount / totalEnriched) * 100)
      : 0
    const diversityScore = coveredCount > 0
      ? Math.round((1 - Math.abs(trueCount / coveredCount - 0.5) * 2) * 100) / 100
      : 0

    return {
      key: row.key,
      displayText: row.display_text,
      trueCount,
      falseCount,
      nullCount,
      definedCount,
      missingCount,
      coveragePct,
      diversityScore,
    }
  })

  const totalActive = attributes.length

  return jsonResponse({
    totalEnriched,
    totalActive,
    category,
    attributes,
  } satisfies AdminCoverageResponse)
}
