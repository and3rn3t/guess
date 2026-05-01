import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'
import { runServerEnrichBatch } from './run'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const kv = env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{ action?: string; limit?: number }>(context.request)
  const action = body?.action ?? 'start'

  if (action === 'stop') {
    await kv.delete('admin:enrich-start')
    return jsonResponse({ ok: true, message: 'Enrichment job signal cleared' })
  }

  if (!env.OPENAI_API_KEY) {
    return errorResponse('OPENAI_API_KEY not configured — cannot run server-side enrichment', 503)
  }

  const limit = Math.min(10, Math.max(1, body?.limit ?? 5))
  const batchId = crypto.randomUUID()

  // Set KV flag immediately so SSE stream shows jobActive: true
  await kv.put(
    'admin:enrich-start',
    JSON.stringify({ queuedAt: Date.now(), batchId }),
    { expirationTtl: 3600 }
  )

  // Run enrichment in the background; response returns immediately
  context.waitUntil(runServerEnrichBatch(env, batchId, limit))

  return jsonResponse(
    { ok: true, message: `Enrichment started for up to ${limit} character${limit !== 1 ? 's' : ''}`, batchId },
    202
  )
}
