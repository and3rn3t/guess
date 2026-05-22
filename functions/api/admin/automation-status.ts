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
import { d1CacheGet } from '../_d1_cache'

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

  const db = env.GUESS_DB
  const report = await d1CacheGet<unknown>(db, AUTOMATION_REPORT_KEY)

  const response = respond(
    jsonResponse({
      report,
      fetchedAt: Date.now(),
    } satisfies AutomationStatusResponse),
  )
  response.headers.set('cache-control', 'private, max-age=15')
  return response
}
