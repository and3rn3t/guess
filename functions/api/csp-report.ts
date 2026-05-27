import { type Env, checkRateLimitBestEffort, logError } from './_helpers'

// ── POST /api/csp-report ─────────────────────────────────────
// Receives browser CSP violation reports, upserts into `csp_violations`
// (dedup on directive + blocked_uri so a spammy violation increments
// `count` instead of writing N rows). Referenced by the
// Content-Security-Policy `report-uri` directive.

interface CspReportBody {
  'violated-directive'?: string
  'effective-directive'?: string
  'blocked-uri'?: string
  'document-uri'?: string
  'source-file'?: string
}

function truncate(value: string | undefined | null, max: number): string | null {
  if (value == null) return null
  const str = String(value)
  return str.length > max ? str.slice(0, max) : str
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // IP-based rate limit: 100 reports/hour per IP to prevent log flooding.
  const ip =
    context.request.headers.get('CF-Connecting-IP') ??
    context.request.headers.get('CF-Ray') ??
    'unknown'
  const { allowed } = await checkRateLimitBestEffort(context.env, ip, 'csp-report', 100)
  if (!allowed) return new Response(null, { status: 429 })

  let report: unknown
  try {
    const text = await context.request.text()
    if (text.length > 5_000) return new Response(null, { status: 413 })
    report = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }

  const body = (report as { 'csp-report'?: CspReportBody })?.['csp-report']
  // effective-directive is the modern field; fall back to violated-directive
  // for older browsers. Both can include a source filter ("script-src 'self'"),
  // so split on whitespace and keep the first token.
  const rawDirective = String(
    body?.['effective-directive'] ?? body?.['violated-directive'] ?? 'unknown',
  )
  const directive = (rawDirective.split(/\s+/)[0] ?? 'unknown').slice(0, 100)
  const blockedUri = truncate(body?.['blocked-uri'] ?? 'unknown', 200) ?? 'unknown'
  const documentUri = truncate(body?.['document-uri'], 500)
  const userAgent = truncate(context.request.headers.get('User-Agent'), 200)

  const db = context.env.GUESS_DB
  if (db) {
    // Off the request hot path — PI.3 convention.
    context.waitUntil(
      (async () => {
        try {
          await db
            .prepare(
              `INSERT INTO csp_violations (directive, blocked_uri, document_uri, user_agent, count, first_seen, last_seen)
               VALUES (?, ?, ?, ?, 1, unixepoch() * 1000, unixepoch() * 1000)
               ON CONFLICT(directive, blocked_uri) DO UPDATE SET
                 count = count + 1,
                 last_seen = unixepoch() * 1000,
                 document_uri = COALESCE(excluded.document_uri, csp_violations.document_uri),
                 user_agent = COALESCE(excluded.user_agent, csp_violations.user_agent)`,
            )
            .bind(directive, blockedUri, documentUri, userAgent)
            .run()
        } catch (err) {
          // Fall back to error_logs so a D1 write failure doesn't lose the signal entirely.
          // Already inside waitUntil so no await needed (and PI.3 hot-path guard forbids it).
          void logError(
            context.env,
            'csp',
            'error',
            `csp_violations upsert failed: ${(err as Error).message}`,
            JSON.stringify({ directive, blockedUri }),
          )
        }
      })(),
    )
  }

  // 204 No Content — browsers don't need a response body
  return new Response(null, { status: 204 })
}
