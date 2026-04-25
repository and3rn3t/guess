import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  checkRateLimit,
  getOrCreateUserId,
  withSetCookie,
  d1Run,
} from '../_helpers'

// ── Types ────────────────────────────────────────────────────

interface ClientEvent {
  id: string          // client-generated UUID (used for idempotency)
  sessionId?: string  // game session ID (optional — may fire pre-game)
  eventType: string   // 'game_start' | 'game_end' | 'share' | 'feature_use' | etc.
  data?: unknown      // free-form event payload
  clientTs?: number   // client timestamp (ms since epoch)
}

interface EventsRequest {
  events: ClientEvent[]
}

// ── Guards ───────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = new Set([
  'game_start',
  'game_end',
  'share',
  'feature_use',
  'question_skip',
  'guess_rejected',
])

const MAX_EVENTS_PER_BATCH = 50
const MAX_BATCH_BYTES = 64 * 1024  // 64 KB

function isValidEventId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
}

function isValidEventType(type: unknown): type is string {
  return typeof type === 'string' && ALLOWED_EVENT_TYPES.has(type)
}

function isValidSessionId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
}

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

    const body = await parseJsonBody<EventsRequest>(context.request)
    if (!body?.events || !Array.isArray(body.events)) {
      return withSetCookie(errorResponse('Invalid request: events array required', 400), setCookieHeader)
    }

    if (body.events.length > MAX_EVENTS_PER_BATCH) {
      return withSetCookie(errorResponse(`Too many events (max ${MAX_EVENTS_PER_BATCH} per batch)`, 400), setCookieHeader)
    }

    // Validate and filter events
    const validEvents = body.events.filter((e): e is ClientEvent => {
      if (!isValidEventId(e.id)) return false
      if (!isValidEventType(e.eventType)) return false
      if (e.sessionId != null && !isValidSessionId(e.sessionId)) return false
      return true
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
