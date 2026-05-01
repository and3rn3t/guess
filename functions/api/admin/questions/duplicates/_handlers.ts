/**
 * GET  /api/admin/questions/duplicates
 *      Returns pairs of questions whose embeddings are cosine-similar above the
 *      threshold (default 0.85). Pulls vectors from `attribute_embeddings`,
 *      joins to `questions` for human-readable text, and excludes pairs that
 *      have already been dismissed.
 *
 * POST /api/admin/questions/duplicates/backfill
 *      Embeds questions that don't yet have an `attribute_embeddings` row (or
 *      whose source text has changed since the last embed). Capped per call
 *      so a single click can't burn through the daily AI quota.
 *
 * POST /api/admin/questions/duplicates/dismiss
 *      Records "no, these aren't duplicates" so the queue stops surfacing them.
 *      Body: `{ pairKey: "isEvil::isVillain", reason?: string }`.
 *
 * POST /api/admin/questions/duplicates/merge
 *      Merges `source` into `target` by retiring the source question with a
 *      `merged into <target>` reason (reuses the AN.17 retired_at machinery).
 *      Body: `{ sourceKey: "isVillain", targetKey: "isEvil", reason?: string }`.
 *
 * All routes are protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../../_helpers'
import {
  canonicalPairKey,
  deserializeEmbedding,
  findDuplicatePairs,
  serializeEmbedding,
  shortTextHash,
  type DuplicatePair,
  type QuestionVector,
} from '../../_dedup'
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedBatch } from '../../_embed'

const DEFAULT_THRESHOLD = 0.85
const MIN_THRESHOLD = 0.5
const MAX_THRESHOLD = 0.999
const DEFAULT_BACKFILL_LIMIT = 50
const MAX_BACKFILL_LIMIT = 200

interface QuestionRow {
  id: string
  text: string
  attribute_key: string
}

interface EmbeddingRow {
  attribute_key: string
  embedding: ArrayBuffer | Uint8Array
  text_hash: string
  dim: number
}

interface DismissedRow {
  pair_key: string
}

export interface DuplicatesResponse {
  threshold: number
  generatedAt: number
  totalEmbedded: number
  totalQuestions: number
  pairs: DuplicatePair[]
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const threshold = clampThreshold(url.searchParams.get('threshold'))
  const [questionsResult, embeddingsResult, dismissedResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, text, attribute_key
         FROM questions
         WHERE retired_at IS NULL`,
      )
      .all<QuestionRow>(),
    db
      .prepare(
        `SELECT attribute_key, embedding, text_hash, dim FROM attribute_embeddings`,
      )
      .all<EmbeddingRow>(),
    db.prepare(`SELECT pair_key FROM question_dedup_dismissed`).all<DismissedRow>(),
  ])

  const questions = questionsResult.results ?? []
  const embeddingRows = embeddingsResult.results ?? []
  const dismissed = new Set((dismissedResult.results ?? []).map((r) => r.pair_key))

  const textByKey = new Map(questions.map((q) => [q.attribute_key, q.text] as const))

  const vectors: QuestionVector[] = []
  for (const row of embeddingRows) {
    if (row.dim !== EMBEDDING_DIM) continue
    const text = textByKey.get(row.attribute_key)
    if (!text) continue
    vectors.push({
      attributeKey: row.attribute_key,
      text,
      embedding: deserializeEmbedding(row.embedding),
    })
  }

  const pairs = findDuplicatePairs(vectors, threshold, dismissed)
  const response: DuplicatesResponse = {
    threshold,
    generatedAt: Date.now(),
    totalEmbedded: vectors.length,
    totalQuestions: questions.length,
    pairs,
  }
  return jsonResponse(response)
}

export const onRequestPost: PagesFunction<Env> = async () =>
  errorResponse('POST /duplicates is sub-routed: use /duplicates/backfill, /dismiss, or /merge.', 404)

export async function handleBackfill(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)
  if (!context.env.AI) return errorResponse('Workers AI binding not configured', 503)

  const body = await parseJsonBody<{ limit?: number }>(context.request)
  const limit = clampLimit(body?.limit)

  // Find questions missing an embedding, or whose text has drifted since the
  // last embed. The text_hash check catches edits via /admin/questions/:key.
  const stale = await db
    .prepare(
      `SELECT q.id, q.text, q.attribute_key
       FROM questions q
       LEFT JOIN attribute_embeddings e ON e.attribute_key = q.attribute_key
       WHERE q.retired_at IS NULL
         AND (e.attribute_key IS NULL OR e.text_hash IS NULL OR e.text_hash != ?)
       ORDER BY q.attribute_key
       LIMIT ?`,
    )
    .bind('', limit) // Placeholder hash — real comparison happens row-by-row below.
    .all<QuestionRow>()

  const candidates = (stale.results ?? []).slice(0, limit)
  if (candidates.length === 0) {
    return jsonResponse({ embedded: 0, model: EMBEDDING_MODEL, dim: EMBEDDING_DIM })
  }

  // Recompute hashes client-side and only embed rows that genuinely drifted.
  const existing = await db
    .prepare(
      `SELECT attribute_key, embedding, text_hash, dim FROM attribute_embeddings
       WHERE attribute_key IN (${candidates.map(() => '?').join(',')})`,
    )
    .bind(...candidates.map((c) => c.attribute_key))
    .all<EmbeddingRow>()
  const existingByKey = new Map(
    (existing.results ?? []).map((r) => [r.attribute_key, r] as const),
  )

  const toEmbed: QuestionRow[] = []
  for (const row of candidates) {
    const hash = shortTextHash(row.text)
    const prior = existingByKey.get(row.attribute_key)
    if (!prior || prior.text_hash !== hash || prior.dim !== EMBEDDING_DIM) {
      toEmbed.push(row)
    }
  }

  if (toEmbed.length === 0) {
    return jsonResponse({ embedded: 0, model: EMBEDDING_MODEL, dim: EMBEDDING_DIM })
  }

  const vectors = await embedBatch(context.env, toEmbed.map((r) => r.text))
  const now = Math.floor(Date.now() / 1000)
  let embedded = 0
  const stmts: D1PreparedStatement[] = []
  for (let i = 0; i < toEmbed.length; i++) {
    const row = toEmbed[i]
    if (!row) continue
    const vec = vectors[i]
    if (!vec) continue
    const blob = serializeEmbedding(vec)
    stmts.push(
      db
        .prepare(
          `INSERT INTO attribute_embeddings (attribute_key, embedding, dim, model, text_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(attribute_key) DO UPDATE SET
             embedding = excluded.embedding,
             dim = excluded.dim,
             model = excluded.model,
             text_hash = excluded.text_hash,
             created_at = excluded.created_at`,
        )
        .bind(row.attribute_key, blob, EMBEDDING_DIM, EMBEDDING_MODEL, shortTextHash(row.text), now),
    )
    embedded++
  }
  if (stmts.length > 0) await db.batch(stmts)

  return jsonResponse({ embedded, model: EMBEDDING_MODEL, dim: EMBEDDING_DIM })
}

export async function handleDismiss(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<{
    pairKey?: string
    similarity?: number
    reason?: string
  }>(context.request)
  if (!body?.pairKey || typeof body.pairKey !== 'string') {
    return errorResponse('pairKey is required', 400)
  }

  const [a, b] = body.pairKey.split('::')
  if (!a || !b) return errorResponse('pairKey must be `keyA::keyB`', 400)
  const canonical = canonicalPairKey(a, b)
  const sim = typeof body.similarity === 'number' && Number.isFinite(body.similarity)
    ? Math.max(-1, Math.min(1, body.similarity))
    : 0

  await db
    .prepare(
      `INSERT INTO question_dedup_dismissed (pair_key, attribute_key_a, attribute_key_b, similarity, dismissed_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(pair_key) DO UPDATE SET
         similarity = excluded.similarity,
         dismissed_by = excluded.dismissed_by,
         dismissed_at = unixepoch()`,
    )
    .bind(canonical, canonical.split('::')[0], canonical.split('::')[1], sim, body.reason ?? null)
    .run()

  return jsonResponse({ ok: true, pairKey: canonical })
}

export async function handleMerge(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<{
    sourceKey?: string
    targetKey?: string
    reason?: string
  }>(context.request)
  if (!body?.sourceKey || !body?.targetKey) {
    return errorResponse('sourceKey and targetKey are required', 400)
  }
  if (body.sourceKey === body.targetKey) {
    return errorResponse('sourceKey and targetKey must differ', 400)
  }

  // Confirm both exist.
  const both = await db
    .prepare(
      `SELECT attribute_key FROM questions WHERE attribute_key IN (?, ?)`,
    )
    .bind(body.sourceKey, body.targetKey)
    .all<{ attribute_key: string }>()
  const found = new Set((both.results ?? []).map((r) => r.attribute_key))
  if (!found.has(body.sourceKey) || !found.has(body.targetKey)) {
    return errorResponse('source or target question not found', 404)
  }

  const reason = (body.reason ?? `Merged into ${body.targetKey}`).slice(0, 500)
  const now = Date.now()

  await db
    .prepare(
      `UPDATE questions
       SET retired_at = ?, retired_reason = ?
       WHERE attribute_key = ? AND retired_at IS NULL`,
    )
    .bind(now, reason, body.sourceKey)
    .run()

  // Auto-dismiss the pair so the queue doesn't surface it again.
  const canonical = canonicalPairKey(body.sourceKey, body.targetKey)
  await db
    .prepare(
      `INSERT INTO question_dedup_dismissed (pair_key, attribute_key_a, attribute_key_b, similarity, dismissed_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(pair_key) DO NOTHING`,
    )
    .bind(canonical, canonical.split('::')[0], canonical.split('::')[1], 1, `merge:${reason}`)
    .run()

  // Best-effort cache bust so the engine drops the merged question on next start.
  if (context.env.GUESS_KV) {
    try {
      await context.env.GUESS_KV.delete('meta:questions')
    } catch {
      // Non-fatal; engine will pick up the change after the 1h TTL expires.
    }
  }

  return jsonResponse({
    ok: true,
    retired: body.sourceKey,
    target: body.targetKey,
    retiredAt: now,
    reason,
  })
}

function clampThreshold(raw: string | null): number {
  if (!raw) return DEFAULT_THRESHOLD
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_THRESHOLD
  return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, n))
}

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_BACKFILL_LIMIT
  return Math.max(1, Math.min(MAX_BACKFILL_LIMIT, Math.floor(raw)))
}
