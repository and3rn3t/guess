/**
 * GET /api/admin/automation-status — latest cron automation report for Mission Control.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  withRequestId,
} from '../_helpers'

const AUTOMATION_REPORT_KEY = 'admin:automation:last-run'

interface AutomationStatusResponse {
  report: unknown | null
  fetchedAt: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.automation-status.read', 600)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  const kv = env.GUESS_ASSETS ?? env.GUESS_KV
  if (!kv) return respond(errorResponse('KV not configured', 503))

  const report = await kv.get(AUTOMATION_REPORT_KEY, 'json')

  const response = respond(
    jsonResponse({
      report,
      fetchedAt: Date.now(),
    } satisfies AutomationStatusResponse),
  )
  response.headers.set('cache-control', 'private, max-age=15')
  return response
}
