/**
 * GET /api/admin/data-quality/closure-queue-status
 *
 * Returns the latest persisted DQ.33 closure queue report from KV so admin UI
 * can surface freshness and avoid stale interpretation when snapshot cadence
 * lags or cron is disabled.
 */
import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  withRequestId,
} from '../../_helpers'
import { CLOSURE_QUEUE_REPORT_KEY, type ClosureQueueReport } from './_closure_queue'
import { d1CacheGet } from '../../_d1_cache'

interface ClosureQueueStatusResponse {
  report: ClosureQueueReport | null
  fetchedAt: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.data-quality.closure-queue-status.read', 600)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  const report = await d1CacheGet<ClosureQueueReport>(env.GUESS_DB, CLOSURE_QUEUE_REPORT_KEY)

  const response = respond(
    jsonResponse({
      report,
      fetchedAt: Date.now(),
    } satisfies ClosureQueueStatusResponse),
  )
  response.headers.set('cache-control', 'private, max-age=15')
  return response
}
