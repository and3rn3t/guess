/**
 * POST /api/admin/questions/:key/unretire — AN.17
 *
 * Reverses a retirement: clears `retired_at` and `retired_reason` so the game
 * engine resumes asking the question. Idempotent: unretiring a live question
 * is a no-op that still returns 200.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../../../_helpers'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const key = context.params.key
  if (!key || typeof key !== 'string') return errorResponse('Missing question key', 400)

  const result = await db
    .prepare(`UPDATE questions SET retired_at = NULL, retired_reason = NULL WHERE attribute_key = ?`)
    .bind(key)
    .run()

  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('Question not found', 404)
  }

  // Invalidate the questions D1 cache so the unretired question reappears in
  // the next game without waiting for the 1h cache TTL.
  try {
    const { d1CacheDelete } = await import('../../../_d1_cache')
    await d1CacheDelete(db, 'meta:questions')
  } catch {
    // best-effort
  }

  return jsonResponse({ ok: true, unretired: result.meta.changes })
}
