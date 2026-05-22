/**
 * GET /api/admin/source-health-status
 *
 * Returns the latest persisted DQ.34 source-health report from KV so admin
 * surfaces can display freshness without recomputing heavy scans.
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
import { SOURCE_HEALTH_REPORT_KEY, type SourceHealthReport } from '../_source_health'
import { d1CacheGet } from '../_d1_cache'

interface SourceHealthStatusResponse {
  report: SourceHealthReport | null
  fetchedAt: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.source-health-status.read', 600)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  const report = await d1CacheGet<SourceHealthReport>(env.GUESS_DB, SOURCE_HEALTH_REPORT_KEY)

  const response = respond(
    jsonResponse({
      report,
      fetchedAt: Date.now(),
    } satisfies SourceHealthStatusResponse),
  )
  response.headers.set('cache-control', 'private, max-age=15')
  return response
}
