/**
 * GET /api/admin/analytics — paginated client_events with per-type summary
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const eventType = url.searchParams.get('event_type') ?? ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const offset = (page - 1) * pageSize

  const where = eventType ? 'WHERE event_type = ?' : ''
  const filterParams: string[] = eventType ? [eventType] : []

  const [rows, totalRow, summary] = await Promise.all([
    db
      .prepare(
        `SELECT id, session_id, user_id, event_type, data, client_ts, created_at
         FROM client_events
         ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...filterParams, pageSize, offset)
      .all<{
        id: string
        session_id: string | null
        user_id: string | null
        event_type: string
        data: string | null
        client_ts: number | null
        created_at: number
      }>(),
    db
      .prepare(`SELECT COUNT(*) as n FROM client_events ${where}`)
      .bind(...filterParams)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT event_type, COUNT(*) as count
         FROM client_events
         GROUP BY event_type
         ORDER BY count DESC`
      )
      .all<{ event_type: string; count: number }>(),
  ])

  return jsonResponse({
    events: rows.results ?? [],
    total: totalRow?.n ?? 0,
    page,
    pageSize,
    summary: summary.results ?? [],
  })
}
