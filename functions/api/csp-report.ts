import { type Env, logError } from './_helpers'

// ── POST /api/csp-report ─────────────────────────────────────
// Receives browser CSP violation reports and stores them in error_logs.
// Referenced by the Content-Security-Policy `report-uri` directive.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let report: unknown
  try {
    // Browsers send `application/csp-report` (JSON body)
    const text = await context.request.text()
    report = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }

  const body = (report as { 'csp-report'?: Record<string, unknown> })?.['csp-report']
  const blockedUri = String(body?.['blocked-uri'] ?? 'unknown').slice(0, 200)
  const violatedDirective = String(body?.['violated-directive'] ?? 'unknown').slice(0, 100)
  const message = `CSP violation: ${violatedDirective} blocked ${blockedUri}`

  context.waitUntil(
    logError(context.env.GUESS_DB, 'csp', 'warn', message, JSON.stringify(body).slice(0, 500)),
  )

  // 204 No Content — browsers don't need a response body
  return new Response(null, { status: 204 })
}
