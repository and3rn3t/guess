/**
 * PATCH /api/admin/questions/:key — update question_text or is_active for an attribute definition
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const key = context.params.key
  if (!key || typeof key !== 'string') return errorResponse('Missing question key', 400)

  const body = await parseJsonBody<{ questionText?: string; isActive?: boolean }>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const updates: string[] = []
  const values: (string | number)[] = []

  if (body.questionText !== undefined) {
    const text = body.questionText.trim()
    if (text.length < 10 || text.length > 300) {
      return errorResponse('questionText must be 10–300 characters', 400)
    }
    updates.push('question_text = ?')
    values.push(text)
  }

  if (body.isActive !== undefined) {
    updates.push('is_active = ?')
    values.push(body.isActive ? 1 : 0)
  }

  if (updates.length === 0) return errorResponse('No fields to update', 400)

  values.push(key)
  const result = await db
    .prepare(`UPDATE attribute_definitions SET ${updates.join(', ')} WHERE key = ?`)
    .bind(...values)
    .run()

  if (result.meta.changes === 0) return errorResponse('Question not found', 404)

  return jsonResponse({ ok: true })
}
