import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (_context) => {
  // Corrections feature is deprecated — no new corrections are accepted via API.
  return jsonResponse({ items: [], total: 0 })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<{ action?: string; characterId?: string }>(context.request)
  if (!body?.action || !body?.characterId) return errorResponse('Missing action or characterId', 400)
  // Corrections feature is deprecated — no data to act on.
  return jsonResponse({ ok: true, applied: 0, message: 'Corrections feature is deprecated' })
}
