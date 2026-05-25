/**
 * AI.6 — GET /api/admin/community/rejected
 *
 * Lists payloads rejected by the moderation gate (`functions/api/_moderation.ts`)
 * so admins can spot-check false positives and tune the Llama-Guard escalation.
 *
 * Query params:
 *   - `status`   : 'pending' (default) | 'reviewed' | 'all'
 *   - `source`   : optional filter — 'v2/characters' | 'admin/proposed-attributes' | 'v2/game/feedback'
 *   - `page`     : 1-based page index (default 1)
 *   - `pageSize` : 1..100 (default 25)
 *
 * PATCH /api/admin/community/rejected
 *   Body: `{ id: number, reviewed_by?: string }` — marks a row as reviewed.
 */

import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'

interface RejectionRow {
  id: number
  source: string
  reason: string
  payload: string
  actor_id: string | null
  reviewed: number
  reviewed_by: string | null
  reviewed_at: number | null
  created_at: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const source = url.searchParams.get('source')
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const offset = (page - 1) * pageSize

  const where: string[] = []
  const params: unknown[] = []
  if (status === 'pending') where.push('reviewed = 0')
  else if (status === 'reviewed') where.push('reviewed = 1')
  if (source) {
    where.push('source = ?')
    params.push(source)
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const [rows, total] = await Promise.all([
    db.prepare(
      `SELECT id, source, reason, payload, actor_id, reviewed, reviewed_by, reviewed_at, created_at
       FROM moderation_rejections ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all<RejectionRow>(),
    db.prepare(`SELECT COUNT(*) as n FROM moderation_rejections ${whereClause}`).bind(...params).first<{ n: number }>(),
  ])

  return jsonResponse({
    rejections: rows.results ?? [],
    total: total?.n ?? 0,
    page,
    pageSize,
  })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<{ id: number; reviewed_by?: string }>(context.request)
  if (!body?.id) return errorResponse('id required', 400)

  await db.prepare(
    `UPDATE moderation_rejections
     SET reviewed = 1, reviewed_by = ?, reviewed_at = unixepoch() * 1000
     WHERE id = ?`
  ).bind(body.reviewed_by ?? 'admin', body.id).run()

  return jsonResponse({ ok: true })
}
