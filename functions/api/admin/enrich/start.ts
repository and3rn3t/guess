import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../_helpers'
import { runServerEnrichBatch } from './run'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const db = env.GUESS_DB
  const body = await parseJsonBody<{ action?: string; limit?: number; batchId?: string }>(context.request)
  const action = body?.action ?? 'start'

  if (action === 'stop') {
    // Clear all non-expired enrich_job rows
    await db.prepare('DELETE FROM enrich_job WHERE expires_at > unixepoch()').run().catch(() => {})
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
    const row = await db
      .prepare('SELECT id FROM enrich_job WHERE batch_id = ? AND expires_at > unixepoch() LIMIT 1')
      .bind(chainBatchId)
      .first<{ id: number }>()
    if (!row) return jsonResponse({ ok: true, message: 'Chain: no active job' })
    context.waitUntil(runServerEnrichBatch(env, chainBatchId, origin))
    return jsonResponse({ ok: true, message: 'Chain: next character started' }, 202)
  }

  const limit = Math.min(10, Math.max(1, body?.limit ?? 5))
  const batchId = crypto.randomUUID()
  const chainToken = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 3600

  // Insert job row — this is what _middleware.ts checks for chain-token auth,
  // and what chainOrClear queries to decide whether to continue or stop.
  await db
    .prepare(
      'INSERT INTO enrich_job (batch_id, remaining, chain_token, chain_token_consumed, expires_at) VALUES (?, ?, ?, 0, ?)',
    )
    .bind(batchId, limit, chainToken, expiresAt)
    .run()

  // Each invocation processes exactly 1 character — chaining handles the rest.
  context.waitUntil(runServerEnrichBatch(env, batchId, origin))

  return jsonResponse(
    { ok: true, message: `Enrichment started for up to ${limit} character${limit !== 1 ? 's' : ''}`, batchId },
    202,
  )
}
