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

  const kv = env.GUESS_ASSETS ?? env.GUESS_KV
  if (!kv) return respond(errorResponse('KV not configured', 503))

  const report = await kv.get(SOURCE_HEALTH_REPORT_KEY, 'json') as SourceHealthReport | null

  const response = respond(
    jsonResponse({
      report,
      fetchedAt: Date.now(),
    } satisfies SourceHealthStatusResponse),
  )
  response.headers.set('cache-control', 'private, max-age=15')
  return response
}
