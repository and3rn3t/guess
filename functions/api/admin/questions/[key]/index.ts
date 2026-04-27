/**
 * PATCH /api/admin/questions/:key — update question_text or is_active for an attribute definition
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../../_helpers'

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const key = context.params.key
  if (!key || typeof key !== 'string') return errorResponse('Missing question key', 400)

  const body = await parseJsonBody<{
    questionText?: string
    isActive?: boolean
    difficulty?: string
  }>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const attrUpdates: string[] = []
  const attrValues: (string | number)[] = []

  if (body.questionText !== undefined) {
    const text = body.questionText.trim()
    if (text.length < 10 || text.length > 300) {
      return errorResponse('questionText must be 10–300 characters', 400)
    }
    attrUpdates.push('question_text = ?')
    attrValues.push(text)
  }

  if (body.isActive !== undefined) {
    attrUpdates.push('is_active = ?')
    attrValues.push(body.isActive ? 1 : 0)
  }

  if (body.difficulty !== undefined) {
    if (!['easy', 'medium', 'hard', null].includes(body.difficulty)) {
      return errorResponse('difficulty must be easy, medium, or hard', 400)
    }
    const diffResult = await db
      .prepare('UPDATE questions SET difficulty = ? WHERE attribute_key = ?')
      .bind(body.difficulty, key)
      .run()
    if (diffResult.meta.changes === 0) return errorResponse('Question not found', 404)
  }

  if (attrUpdates.length === 0 && body.difficulty === undefined) {
    return errorResponse('No fields to update', 400)
  }

  if (attrUpdates.length > 0) {
    attrValues.push(key)
    const result = await db
      .prepare(`UPDATE attribute_definitions SET ${attrUpdates.join(', ')} WHERE key = ?`)
      .bind(...attrValues)
      .run()
    if (result.meta.changes === 0) return errorResponse('Question not found', 404)
  }

  return jsonResponse({ ok: true })
}
