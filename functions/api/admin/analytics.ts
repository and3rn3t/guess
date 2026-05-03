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
  const query = (url.searchParams.get('q') ?? '').trim()
  const daysParam = Number.parseInt(url.searchParams.get('days') ?? '30', 10)
  const days = Number.isNaN(daysParam) ? 30 : Math.max(1, Math.min(365, daysParam))
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const offset = (page - 1) * pageSize

  const whereParts: string[] = []
  const filterParams: (string | number)[] = []

  whereParts.push("created_at >= unixepoch('now', ?) * 1000")
  filterParams.push(`-${days} days`)

  if (eventType) {
    whereParts.push('event_type = ?')
    filterParams.push(eventType)
  }

  if (query) {
    const like = `%${query}%`
    whereParts.push('(event_type LIKE ? OR session_id LIKE ? OR user_id LIKE ? OR data LIKE ?)')
    filterParams.push(like, like, like, like)
  }

  const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

  const [rows, totalRow, summary, aggregateRow] = await Promise.all([
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
         ${where}
         GROUP BY event_type
         ORDER BY count DESC`
      )
      .bind(...filterParams)
      .all<{ event_type: string; count: number }>(),
    db
      .prepare(
        `SELECT
          COUNT(DISTINCT session_id) as sessions,
          COUNT(DISTINCT user_id) as users
         FROM client_events
         ${where}`
      )
      .bind(...filterParams)
      .first<{ sessions: number; users: number }>(),
  ])

  return jsonResponse({
    events: rows.results ?? [],
    total: totalRow?.n ?? 0,
    page,
    pageSize,
    summary: summary.results ?? [],
    filters: {
      eventType,
      q: query,
      days,
    },
    aggregates: {
      uniqueSessions: aggregateRow?.sessions ?? 0,
      uniqueUsers: aggregateRow?.users ?? 0,
    },
  })
}
