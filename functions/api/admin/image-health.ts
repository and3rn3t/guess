import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  withRequestId,
} from '../_helpers'
import { computeImageHealthReport, type ImageHealthCharacterRow } from '../_image_health'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)
  const db = env.GUESS_DB

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.image-health.read', 300)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))
  if (!db) return respond(errorResponse('DB not configured', 503))

  const url = new URL(request.url)
  const issueLimit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '200', 10) || 200, 1), 1000)

  const rowsResult = await db
    .prepare(
      `SELECT id, name, category, popularity, image_url, created_at
         FROM characters`,
    )
    .all<ImageHealthCharacterRow>()

  const rows = rowsResult.results ?? []
  const report = computeImageHealthReport(rows, { issueLimit })

  const response = respond(
    jsonResponse({
      ...report,
      fetchedAt: Date.now(),
      issueLimit,
    }),
  )
  response.headers.set('cache-control', 'private, max-age=30')
  return response
}
