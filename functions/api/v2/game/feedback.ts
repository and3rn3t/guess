import {
  d1Run,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
} from "../../_helpers";
import { FeedbackRequestSchema } from "../../_schemas";

// ── POST /api/v2/game/feedback ─────────────────────────────
// Stores optional post-game reflection for quality loops.

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

    const parsed = await parseJsonBodyWithSchema(
      context.request,
      FeedbackRequestSchema,
    );
    if (!parsed.success) return respond(parsed.response);

    const { sessionId, rating, feedbackText } = parsed.data;

    await d1Run(
      db,
      `INSERT INTO game_feedback (session_id, game_id, rating, feedback_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, sessionId, rating, feedbackText?.trim() || null, Date.now()],
    );

    return respond(jsonResponse({ success: true }));
  } catch (err) {
    console.error("POST /api/v2/game/feedback error:", err);
    context.waitUntil(
      logError(
        context.env.GUESS_DB,
        "feedback",
        "error",
        "feedback write failed",
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
