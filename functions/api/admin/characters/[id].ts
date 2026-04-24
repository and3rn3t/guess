/**
 * PATCH  /api/admin/characters/:id — update a character attribute value
 * DELETE /api/admin/characters/:id — hard delete a character
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'

interface AttributePatch {
  attributeKey: string
  value: 0 | 1 | null
  confidence?: number
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const id = context.params.id
  if (!id || typeof id !== 'string') return errorResponse('Missing character id', 400)

  const body = await parseJsonBody<AttributePatch>(context.request)
  if (!body?.attributeKey) return errorResponse('Missing attributeKey', 400)

  if (body.value !== 0 && body.value !== 1 && body.value !== null) {
    return errorResponse('value must be 0, 1, or null', 400)
  }

  const confidence = body.confidence !== undefined
    ? Math.max(0, Math.min(1, body.confidence))
    : 1.0

  const char = await db.prepare('SELECT id FROM characters WHERE id = ?').bind(id).first()
  if (!char) return errorResponse('Character not found', 404)

  if (body.value === null) {
    await db
      .prepare('DELETE FROM character_attributes WHERE character_id = ? AND attribute_key = ?')
      .bind(id, body.attributeKey)
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO character_attributes (character_id, attribute_key, value, confidence)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (character_id, attribute_key)
         DO UPDATE SET value = excluded.value, confidence = excluded.confidence`
      )
      .bind(id, body.attributeKey, body.value, confidence)
      .run()
  }

  // Update denormalized attribute_count
  await db
    .prepare(
      `UPDATE characters SET attribute_count = (
        SELECT COUNT(*) FROM character_attributes
        WHERE character_id = ? AND value IS NOT NULL
      ) WHERE id = ?`
    )
    .bind(id, id)
    .run()

  return jsonResponse({ ok: true })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const id = context.params.id
  if (!id || typeof id !== 'string') return errorResponse('Missing character id', 400)

  const char = await db
    .prepare('SELECT id, name FROM characters WHERE id = ?')
    .bind(id)
    .first<{ id: string; name: string }>()
  if (!char) return errorResponse('Character not found', 404)

  // ON DELETE CASCADE handles character_attributes rows automatically
  await db.prepare('DELETE FROM characters WHERE id = ?').bind(id).run()

  return jsonResponse({ ok: true, deleted: char.name })
}
