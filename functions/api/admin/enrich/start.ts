import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'
import { runServerEnrichBatch } from './run'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const kv = env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{ action?: string; limit?: number; batchId?: string }>(context.request)
  const action = body?.action ?? 'start'

  if (action === 'stop') {
    await kv.delete('admin:enrich-start')
    return jsonResponse({ ok: true, message: 'Enrichment job signal cleared' })
  }

  if (!env.OPENAI_API_KEY) {
    return errorResponse('OPENAI_API_KEY not configured — cannot run server-side enrichment', 503)
  }

  const origin = new URL(context.request.url).origin

  // Internal chain action — fired by runServerEnrichBatch after completing one
  // character, to start the next character in a fresh Worker invocation.
  // The X-Internal-Chain-Token header is validated by _middleware.ts before
  // reaching here. We verify batchId as an extra double-check.
  if (action === 'chain') {
    const chainBatchId = body?.batchId
    if (!chainBatchId) return errorResponse('Missing batchId', 400)
    const kvRaw = await kv.get('admin:enrich-start')
    if (!kvRaw) return jsonResponse({ ok: true, message: 'Chain: no active job' })
    let kvData: { batchId: string }
    try { kvData = JSON.parse(kvRaw) } catch { return errorResponse('KV parse error', 500) }
    if (kvData.batchId !== chainBatchId) return errorResponse('batchId mismatch', 403)
    context.waitUntil(runServerEnrichBatch(env, chainBatchId, origin))
    return jsonResponse({ ok: true, message: 'Chain: next character started' }, 202)
  }

  const limit = Math.min(10, Math.max(1, body?.limit ?? 5))
  const batchId = crypto.randomUUID()
  // chainToken is a single-use secret included in chain requests so _middleware.ts
  // can let them through without Basic Auth credentials.
  const chainToken = crypto.randomUUID()

  // Set KV flag immediately so SSE stream shows jobActive: true.
  // `remaining` tracks how many more characters to process after the first.
  await kv.put(
    'admin:enrich-start',
    JSON.stringify({ queuedAt: Date.now(), batchId, remaining: limit, chainToken }),
    { expirationTtl: 3600 }
  )

  // Each invocation processes exactly 1 character — chaining handles the rest.
  context.waitUntil(runServerEnrichBatch(env, batchId, origin))

  return jsonResponse(
    { ok: true, message: `Enrichment started for up to ${limit} character${limit !== 1 ? 's' : ''}`, batchId },
    202
  )
}
