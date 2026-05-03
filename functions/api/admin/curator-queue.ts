import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  withRequestId,
} from '../_helpers'
import { buildCurationQueueReport, type CurationIssueType, type CurationQueueRow } from '../_curator_queue'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)
  const db = env.GUESS_DB

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.curator-queue.read', 300)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))
  if (!db) return respond(errorResponse('DB not configured', 503))

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '200', 10) || 200, 1), 1000)
  const issueTypeParam = url.searchParams.get('issue-type')
  const issueTypeFilter: CurationIssueType[] | undefined = issueTypeParam
    ? (issueTypeParam.split(',').filter((t) => ['cannot_infer', 'canon_conflict', 'subjective'].includes(t)) as CurationIssueType[])
    : undefined
  const onlyUnresolved = url.searchParams.get('only-unresolved') !== 'false'

  try {
    const rowsResult = await db
      .prepare(
        `
        SELECT
          id, character_id, attribute_key, issue_type, issue_reason, category,
          assigned_to, resolved_at, resolution_reason, resolution_value,
          locked_until, lock_reason, created_at, updated_at, popularity, priority_score
        FROM curation_queue
        ORDER BY priority_score DESC, created_at ASC
        LIMIT ?
      `,
      )
      .bind(limit + 100)
      .all<CurationQueueRow>()

    const rows = rowsResult.results ?? []
    const report = buildCurationQueueReport(rows, {
      limit,
      issueTypeFilter,
      onlyUnresolved,
    })

    const response = respond(
      jsonResponse({
        report,
        fetchedAt: Date.now(),
        limit,
      }),
    )
    response.headers.set('cache-control', 'private, max-age=30')
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch curator queue'
    return respond(errorResponse(message, 500))
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)
  const db = env.GUESS_DB

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.curator-queue.write', 100)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))
  if (!db) return respond(errorResponse('DB not configured', 503))

  const url = new URL(request.url)
  const pathSegments = url.pathname.split('/')
  const itemIdStr = pathSegments[pathSegments.length - 2]
  const action = pathSegments[pathSegments.length - 1]
  const itemId = Number.parseInt(itemIdStr, 10)

  if (!Number.isInteger(itemId)) {
    return respond(errorResponse('Invalid item ID', 400))
  }

  try {
    const body = (await request.json()) as Record<string, unknown>

    switch (action) {
      case 'assign': {
        if (!body.assignedTo) {
          return respond(errorResponse('assignedTo is required', 400))
        }
        await db
          .prepare('UPDATE curation_queue SET assigned_to = ?, updated_at = ? WHERE id = ?')
          .bind(body.assignedTo, Date.now(), itemId)
          .run()
        return respond(jsonResponse({ success: true, id: itemId, assignedTo: body.assignedTo }))
      }

      case 'resolve': {
        await db
          .prepare('UPDATE curation_queue SET resolved_at = ?, resolution_reason = ?, resolution_value = ?, updated_at = ? WHERE id = ?')
          .bind(Date.now(), body.reason || null, body.value || null, Date.now(), itemId)
          .run()
        return respond(jsonResponse({ success: true, id: itemId, resolvedAt: Date.now() }))
      }

      case 'lock': {
        const durationMinutes = Number(body.durationMinutes ?? 60)
        const lockedUntil = Date.now() + durationMinutes * 60000
        await db
          .prepare('UPDATE curation_queue SET locked_until = ?, lock_reason = ?, updated_at = ? WHERE id = ?')
          .bind(lockedUntil, body.reason || 'Manual lock', Date.now(), itemId)
          .run()
        return respond(jsonResponse({ success: true, id: itemId, lockedUntil }))
      }

      case 'unlock': {
        await db
          .prepare('UPDATE curation_queue SET locked_until = NULL, lock_reason = NULL, updated_at = ? WHERE id = ?')
          .bind(Date.now(), itemId)
          .run()
        return respond(jsonResponse({ success: true, id: itemId, lockedUntil: null }))
      }

      default:
        return respond(errorResponse('Unknown action', 400))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update item'
    return respond(errorResponse(message, 500))
  }
}
