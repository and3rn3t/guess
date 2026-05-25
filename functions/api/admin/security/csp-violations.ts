/**
 * GET /api/admin/security/csp-violations — paginated CSP violation viewer.
 *
 * SE.1 — surfaces the dedup'd `csp_violations` table (one row per
 * directive + blocked_uri pair) for operator triage. Sorted by `count` desc.
 *
 * Protected by Basic auth gate in functions/_middleware.ts (RBAC coverage
 * test asserts every /admin/** path is gated).
 *
 * Query params:
 *   - page (default 1, min 1)
 *   - pageSize (default 50, range 10–200)
 *   - windowDays (default 7, range 1–90) — last_seen filter; matches the cron digest window.
 */
import { type Env, jsonResponse, errorResponse, d1Query } from '../../_helpers'

interface CspViolationRow {
  id: number
  directive: string
  blocked_uri: string
  document_uri: string | null
  user_agent: string | null
  count: number
  first_seen: number
  last_seen: number
}

interface DirectiveBucket {
  directive: string
  count: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    200,
    Math.max(10, Number.parseInt(url.searchParams.get('pageSize') ?? '50', 10)),
  )
  const windowDays = Math.min(
    90,
    Math.max(1, Number.parseInt(url.searchParams.get('windowDays') ?? '7', 10)),
  )
  const offset = (page - 1) * pageSize
  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000

  const [rows, countRow, directives] = await Promise.all([
    d1Query<CspViolationRow>(
      db,
      `SELECT id, directive, blocked_uri, document_uri, user_agent, count, first_seen, last_seen
         FROM csp_violations
        WHERE last_seen >= ?
        ORDER BY count DESC, last_seen DESC
        LIMIT ? OFFSET ?`,
      [sinceMs, pageSize, offset],
    ),
    db
      .prepare(`SELECT COUNT(*) AS count FROM csp_violations WHERE last_seen >= ?`)
      .bind(sinceMs)
      .first<{ count: number }>(),
    d1Query<DirectiveBucket>(
      db,
      `SELECT directive, SUM(count) AS count
         FROM csp_violations
        WHERE last_seen >= ?
        GROUP BY directive
        ORDER BY count DESC`,
      [sinceMs],
    ),
  ])

  return jsonResponse({
    violations: rows,
    total: countRow?.count ?? rows.length,
    page,
    pageSize,
    windowDays,
    directives,
  })
}
