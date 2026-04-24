import { type Env, jsonResponse, errorResponse } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const offset = (page - 1) * pageSize

  const validStatuses = ['pending', 'approved', 'rejected', 'all']
  const filterStatus = validStatuses.includes(status) ? status : 'pending'

  const where = filterStatus === 'all' ? '' : `WHERE status = '${filterStatus}'`

  const [rows, total] = await Promise.all([
    db.prepare(
      `SELECT id, key, display_text, question_text, rationale, example_chars, proposed_by,
              status, reviewed_by, reviewed_at, created_at
       FROM proposed_attributes ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(pageSize, offset).all(),
    db.prepare(`SELECT COUNT(*) as n FROM proposed_attributes ${where}`).first<{ n: number }>(),
  ])

  return jsonResponse({ proposals: rows.results, total: total?.n ?? 0, page, pageSize })
}
