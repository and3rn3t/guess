import {
  checkRateLimitBestEffort,
  d1Run,
  type Env,
  errorResponse,
  getActorId,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
  withSetCookie,
} from "../_helpers";
import { ClientEventSchema, EventsBatchRequestSchema } from "../_schemas";

const MAX_BATCH_BYTES = 64 * 1024; // 64 KB

// ── POST /api/v2/events ──────────────────────────────────────
// Receives a batch of client-side analytics events and persists them to D1.
// Idempotent: duplicate event IDs are silently ignored via INSERT OR IGNORE.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request);
  const actorId = getActorId(context.request);
  const url = new URL(context.request.url);
  const respond = (response: Response): Response =>
    withRequestId(response, requestId);
  const internalError = (): Response =>
    respond(internalErrorResponse(requestId));

  try {
    const db = context.env.GUESS_DB;
    if (!db) return respond(errorResponse("D1 not configured", 503));

    // Enforce body size limit before parsing
    const contentLength = parseInt(
      context.request.headers.get("content-length") ?? "0",
      10,
    );
    if (contentLength > MAX_BATCH_BYTES) {
      return respond(errorResponse("Batch too large (max 64KB)", 413));
    }

    const { userId, setCookieHeader } = await getOrCreateUserId(
      context.request,
      context.env,
    );

    // Rate limit: 20 flushes/hour per user — each flush can contain up to 50 events
    const { allowed } = await checkRateLimitBestEffort(context.env, userId, "events_flush", 20);
    if (!allowed) {
      return respond(
        withSetCookie(
          errorResponse("Rate limit exceeded", 429),
          setCookieHeader,
        ),
      );
    }

    const parsed = await parseJsonBodyWithSchema(
      context.request,
      EventsBatchRequestSchema,
    );
    if (!parsed.success)
      return respond(withSetCookie(parsed.response, setCookieHeader));

    // Validate and filter individual events — invalid items are silently dropped
    // so a single malformed event does not fail the whole batch.
    const validEvents = parsed.data.events.flatMap((e) => {
      const r = ClientEventSchema.safeParse(e);
      return r.success ? [r.data] : [];
    });

    if (validEvents.length === 0) {
      return respond(
        withSetCookie(jsonResponse({ accepted: 0 }), setCookieHeader),
      );
    }

    // Batch insert — INSERT OR IGNORE handles client-side duplicate submissions
    const now = Date.now();
    const placeholders = validEvents.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params = validEvents.flatMap((e) => [
      e.id,
      e.sessionId ?? null,
      userId,
      e.eventType,
      e.data != null ? JSON.stringify(e.data) : null,
      e.clientTs ?? now,
    ]);

    context.waitUntil(
      d1Run(
        db,
        `INSERT OR IGNORE INTO client_events (id, session_id, user_id, event_type, data, client_ts)
         VALUES ${placeholders}`,
        params,
      ).catch(() => {
        /* non-critical — client will retry on next flush */
      }),
    );

    return respond(
      withSetCookie(
        jsonResponse({ accepted: validEvents.length }),
        setCookieHeader,
      ),
    );
  } catch (err) {
    context.waitUntil(
      logError(
        context.env.GUESS_DB,
        "events",
        "error",
        "event ingestion failed",
        err,
        {
          requestId,
          actorId,
          path: url.pathname,
          method: context.request.method,
          status: 500,
        },
      ),
    );
    return internalError();
  }
};
