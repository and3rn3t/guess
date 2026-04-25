/**
 * GET  /api/admin/error-logs — paginated error/warn log viewer
 * DELETE /api/admin/error-logs — clear all (or older than ?before=<ms timestamp>)
 *
 * Protected by Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, d1Query, d1Run } from '../_helpers'
import type { ErrorLogsRow } from '../_db-types'

const VALID_LEVELS = new Set(['error', 'warn'])

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize

  const filterLevel = url.searchParams.get('level') ?? ''
  const filterSource = url.searchParams.get('source') ?? ''

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filterLevel && VALID_LEVELS.has(filterLevel)) {
    conditions.push('level = ?')
    params.push(filterLevel)
  }
  if (filterSource) {
    // Allow partial source match for convenience
    conditions.push('source = ?')
    params.push(filterSource)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [logs, countRow] = await Promise.all([
    d1Query<ErrorLogsRow>(
      db,
      `SELECT id, level, source, message, detail, created_at FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
    db.prepare(`SELECT COUNT(*) as count FROM error_logs ${where}`).bind(...params).first<{ count: number }>(),
  ])

  // Distinct sources for the filter dropdown
  const sources = await d1Query<{ source: string }>(
    db,
    'SELECT DISTINCT source FROM error_logs ORDER BY source ASC'
  )

  return jsonResponse({
    logs,
    total: countRow?.count ?? logs.length,
    page,
    pageSize,
    sources: sources.map((s) => s.source),
  })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const before = url.searchParams.get('before')

  if (before) {
    const ts = parseInt(before, 10)
    if (isNaN(ts)) return errorResponse('Invalid "before" timestamp', 400)
    await d1Run(db, 'DELETE FROM error_logs WHERE created_at < ?', [ts])
  } else {
    await d1Run(db, 'DELETE FROM error_logs')
  }

  return jsonResponse({ success: true })
}
