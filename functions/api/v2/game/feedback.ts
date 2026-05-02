import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  d1Run,
  logError,
} from '../../_helpers'
import { FeedbackRequestSchema } from '../../_schemas'

// ── POST /api/v2/game/feedback ─────────────────────────────
// Stores optional post-game reflection for quality loops.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.GUESS_DB
    if (!db) return errorResponse('D1 not configured', 503)

    const parsed = await parseJsonBodyWithSchema(context.request, FeedbackRequestSchema)
    if (!parsed.success) return parsed.response

    const { sessionId, rating, feedbackText } = parsed.data

    await d1Run(
      db,
      `INSERT INTO game_feedback (session_id, game_id, rating, feedback_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, sessionId, rating, feedbackText?.trim() || null, Date.now()]
    )

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('POST /api/v2/game/feedback error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'feedback', 'error', 'feedback write failed', err))
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Feedback submission failed: ${message}`, 500)
  }
}
