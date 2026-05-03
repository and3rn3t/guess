/**
 * POST /api/admin/questions/bulk — bulk update active/difficulty on question keys
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'

interface BulkUpdateBody {
  keys?: string[]
  isActive?: boolean
  difficulty?: 'easy' | 'medium' | 'hard' | null
}

function uniqueKeys(keys: string[]): string[] {
  return Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)))
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const body = await parseJsonBody<BulkUpdateBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const keys = uniqueKeys(body.keys ?? [])
  if (keys.length === 0) return errorResponse('keys must include at least one item', 400)
  if (keys.length > 500) return errorResponse('Maximum 500 keys per request', 400)

  const hasIsActive = body.isActive !== undefined
  const hasDifficulty = body.difficulty !== undefined

  if (!hasIsActive && !hasDifficulty) {
    return errorResponse('No fields to update', 400)
  }

  if (hasDifficulty && !['easy', 'medium', 'hard', null].includes(body.difficulty ?? null)) {
    return errorResponse('difficulty must be easy, medium, hard, or null', 400)
  }

  const placeholders = keys.map(() => '?').join(', ')
  let updatedDefinitions = 0
  let updatedQuestions = 0

  if (hasIsActive) {
    const result = await db
      .prepare(`UPDATE attribute_definitions SET is_active = ? WHERE key IN (${placeholders})`)
      .bind(body.isActive ? 1 : 0, ...keys)
      .run()
    updatedDefinitions = Number(result.meta.changes ?? 0)
  }

  if (hasDifficulty) {
    const result = await db
      .prepare(`UPDATE questions SET difficulty = ? WHERE attribute_key IN (${placeholders})`)
      .bind(body.difficulty ?? null, ...keys)
      .run()
    updatedQuestions = Number(result.meta.changes ?? 0)
  }

  return jsonResponse({
    ok: true,
    touchedKeys: keys.length,
    updatedDefinitions,
    updatedQuestions,
  })
}
