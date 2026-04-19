/**
 * POST /api/admin/upload-attrs
 *
 * Bulk upload character attributes to D1 via worker binding (bypasses management API rate limits).
 * Protected by a simple shared secret in the ADMIN_SECRET env var.
 *
 * Body: { attributes: [{ c: characterId, k: attributeKey, v: 0|1 }], secret: string }
 * Max 500 rows per request.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../_helpers'

interface UploadRequest {
  secret: string
  attributes?: { c: string; k: string; v: number }[]
  images?: { id: string; url: string }[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db) return errorResponse('D1 not configured', 503)

  const body = await parseJsonBody<UploadRequest>(context.request)
  if (!body?.secret) return errorResponse('Missing secret', 401)

  // Verify admin secret from KV (set via wrangler kv:key put)
  const adminSecret = await kv?.get('admin:secret')
  if (!adminSecret || body.secret !== adminSecret) {
    return errorResponse('Unauthorized', 403)
  }

  let attrCount = 0
  let imgCount = 0
  const errors: string[] = []

  // Upload attributes
  if (body.attributes && body.attributes.length > 0) {
    if (body.attributes.length > 500) {
      return errorResponse('Max 500 attribute rows per request', 400)
    }

    try {
      const prepared = body.attributes.map((a) =>
        db.prepare('INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, ?, 0.8)').bind(a.c, a.k, a.v)
      )
      await db.batch(prepared)
      attrCount = prepared.length
    } catch (e) {
      errors.push(`attributes: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Update image URLs
  if (body.images && body.images.length > 0) {
    if (body.images.length > 500) {
      return errorResponse('Max 500 image updates per request', 400)
    }

    try {
      const prepared = body.images.map((img) =>
        db.prepare('UPDATE characters SET image_url = ? WHERE id = ?').bind(img.url, img.id)
      )
      await db.batch(prepared)
      imgCount = prepared.length
    } catch (e) {
      errors.push(`images: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return jsonResponse({ ok: true, attributes: attrCount, images: imgCount, errors: errors.length > 0 ? errors : undefined })
}
