import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{ action?: string }>(context.request)
  const action = body?.action ?? 'start'

  if (action === 'stop') {
    await kv.delete('admin:enrich-start')
    return jsonResponse({ ok: true, message: 'Enrichment job signal cleared' })
  }

  // Set a flag that CLI enrichment scripts can poll to trigger a run
  const payload = JSON.stringify({ queuedAt: Date.now() })
  await kv.put('admin:enrich-start', payload, { expirationTtl: 3600 })
  return jsonResponse({ ok: true, message: 'Enrichment job queued — CLI scripts will pick up the signal' }, 202)
}
