import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  checkRateLimit,
  getOrCreateUserId,
  withSetCookie,
  d1Run,
} from '../_helpers'
import { ClientEventSchema, EventsBatchRequestSchema } from '../_schemas'


const MAX_BATCH_BYTES = 64 * 1024  // 64 KB

// ── POST /api/v2/events ──────────────────────────────────────
// Receives a batch of client-side analytics events and persists them to D1.
// Idempotent: duplicate event IDs are silently ignored via INSERT OR IGNORE.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.GUESS_DB
    const kv = context.env.GUESS_KV
    if (!db || !kv) return errorResponse('D1/KV not configured', 503)

    // Enforce body size limit before parsing
    const contentLength = parseInt(context.request.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_BATCH_BYTES) {
      return errorResponse('Batch too large (max 64KB)', 413)
    }

    const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)

    // Rate limit: 20 flushes/hour per user — each flush can contain up to 50 events
    const { allowed } = await checkRateLimit(kv, userId, 'events_flush', 20)
    if (!allowed) {
      return withSetCookie(errorResponse('Rate limit exceeded', 429), setCookieHeader)
    }

    const parsed = await parseJsonBodyWithSchema(context.request, EventsBatchRequestSchema)
    if (!parsed.success) return withSetCookie(parsed.response, setCookieHeader)

    // Validate and filter individual events — invalid items are silently dropped
    // so a single malformed event does not fail the whole batch.
    const validEvents = parsed.data.events.flatMap((e) => {
      const r = ClientEventSchema.safeParse(e)
      return r.success ? [r.data] : []
    })

    if (validEvents.length === 0) {
      return withSetCookie(jsonResponse({ accepted: 0 }), setCookieHeader)
    }

    // Batch insert — INSERT OR IGNORE handles client-side duplicate submissions
    const now = Date.now()
    const placeholders = validEvents.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const params = validEvents.flatMap((e) => [
      e.id,
      e.sessionId ?? null,
      userId,
      e.eventType,
      e.data != null ? JSON.stringify(e.data) : null,
      e.clientTs ?? now,
    ])

    context.waitUntil(
      d1Run(
        db,
        `INSERT OR IGNORE INTO client_events (id, session_id, user_id, event_type, data, client_ts)
         VALUES ${placeholders}`,
        params
      ).catch(() => { /* non-critical — client will retry on next flush */ })
    )

    return withSetCookie(jsonResponse({ accepted: validEvents.length }), setCookieHeader)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Event ingestion failed: ${message}`, 500)
  }
}
