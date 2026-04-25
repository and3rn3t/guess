/**
 * GET  /api/admin/enrichment — enrichment status summary + per-character breakdown
 * POST /api/admin/enrichment/retry — mark unenriched characters for re-processing via KV flag
 *
 * "Enriched" is proxied as: image_url IS NOT NULL (characters that have gone through
 * the enrichment pipeline get an R2-hosted image URL).
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

interface EnrichmentSummary {
  total: number
  enriched: number
  pending: number
  coveragePct: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize
  const filter = url.searchParams.get('filter') ?? 'pending' // 'all'|'enriched'|'pending'

  // Build character list filter before the parallel queries
  let whereClause = ''
  if (filter === 'enriched') whereClause = 'WHERE image_url IS NOT NULL'
  else if (filter === 'pending') whereClause = 'WHERE image_url IS NULL'

  const [summaryResult, rows] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) as enriched
      FROM characters
    `).first<{ total: number; enriched: number }>(),
    db
      .prepare(
        `SELECT id, name, category, image_url, created_at
       FROM characters
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
      )
      .bind(pageSize, offset)
      .all<{ id: string; name: string; category: string; image_url: string | null; created_at: number }>(),
  ])

  const total = summaryResult?.total ?? 0
  const enriched = summaryResult?.enriched ?? 0
  const pending = total - enriched

  const summary: EnrichmentSummary = {
    total,
    enriched,
    pending,
    coveragePct: total > 0 ? Math.round((enriched / total) * 100) : 0,
  }

  const characters = (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    imageUrl: r.image_url,
    enriched: r.image_url !== null,
    createdAt: r.created_at,
  }))

  const totalForFilter =
    filter === 'enriched' ? enriched : filter === 'pending' ? pending : total

  return jsonResponse({ summary, characters, total: totalForFilter, page, pageSize })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  // Count how many characters need enrichment
  const result = await db
    .prepare('SELECT COUNT(*) as total FROM characters WHERE image_url IS NULL')
    .first<{ total: number }>()

  const count = result?.total ?? 0
  if (count === 0) return jsonResponse({ ok: true, queued: 0, message: 'All characters already enriched' })

  // Set a KV flag that the enrichment CLI/pipeline checks
  await kv.put('admin:enrich-retry', JSON.stringify({ requestedAt: Date.now(), count }), {
    expirationTtl: 3600,
  })

  return jsonResponse({ ok: true, queued: count })
}
