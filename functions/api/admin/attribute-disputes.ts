import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const status = url.searchParams.get('status') ?? 'open'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const offset = (page - 1) * pageSize

  const validStatuses = ['open', 'resolved', 'dismissed', 'all']
  const filterStatus = validStatuses.includes(status) ? status : 'open'
  const where = filterStatus === 'all' ? '' : `WHERE ad.status = '${filterStatus}'`

  const [rows, total] = await Promise.all([
    db.prepare(`
      SELECT ad.id, ad.character_id, ad.attribute_key, ad.current_value,
             ad.dispute_reason, ad.confidence, ad.disputed_by,
             ad.created_at, ad.status, ad.resolved_by, ad.resolved_at,
             c.name AS character_name
      FROM attribute_disputes ad
      LEFT JOIN characters c ON c.id = ad.character_id
      ${where}
      ORDER BY ad.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all(),
    db.prepare(`SELECT COUNT(*) as n FROM attribute_disputes ${where}`).first<{ n: number }>(),
  ])

  return jsonResponse({ disputes: rows.results, total: total?.n ?? 0, page, pageSize })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<{ id: number; status: string; resolved_by?: string }>(context.request)
  if (!body?.id || !body.status) return errorResponse('id and status required', 400)

  const validStatuses = ['resolved', 'dismissed']
  if (!validStatuses.includes(body.status)) return errorResponse('status must be resolved or dismissed', 400)

  await db.prepare(`
    UPDATE attribute_disputes
    SET status = ?, resolved_by = ?, resolved_at = unixepoch()
    WHERE id = ?
  `).bind(body.status, body.resolved_by ?? 'admin', body.id).run()

  return jsonResponse({ ok: true })
}
