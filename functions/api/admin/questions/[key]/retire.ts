/**
 * POST /api/admin/questions/:key/retire — AN.17
 *
 * Marks every `questions` row with `attribute_key = :key` as retired so the
 * game engine stops asking them. Idempotent: re-retiring an already-retired
 * question refreshes the timestamp + reason.
 *
 * Body (optional): { reason?: string }   — max 500 chars
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../../_helpers'

const MAX_REASON_LEN = 500

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const key = context.params.key
  if (!key || typeof key !== 'string') return errorResponse('Missing question key', 400)

  const body = await parseJsonBody<{ reason?: string }>(context.request).catch(() => null)
  let reason: string | null = null
  if (body && typeof body.reason === 'string') {
    const trimmed = body.reason.trim()
    if (trimmed.length > MAX_REASON_LEN) {
      return errorResponse(`reason must be ≤ ${MAX_REASON_LEN} characters`, 400)
    }
    reason = trimmed.length > 0 ? trimmed : null
  }

  const result = await db
    .prepare(`UPDATE questions SET retired_at = ?, retired_reason = ? WHERE attribute_key = ?`)
    .bind(Date.now(), reason, key)
    .run()

  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('Question not found', 404)
  }

  // Invalidate the questions KV cache so retirement takes effect on the next
  // game start instead of waiting up to QUESTIONS_CACHE_TTL (1h) for the
  // cached payload to expire.
  const kv = (context.env as { GUESS_KV?: KVNamespace }).GUESS_KV
  if (kv) {
    try {
      await kv.delete('meta:questions')
    } catch {
      // KV delete is best-effort; the next gameStart will still query D1 once
      // the TTL expires.
    }
  }

  return jsonResponse({ ok: true, retired: result.meta.changes, reason })
}
