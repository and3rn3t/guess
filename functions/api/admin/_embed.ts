/**
 * B.4 — Workers AI embedding helpers.
 *
 * Wraps the `@cf/baai/bge-base-en-v1.5` call so the rest of the dedup code
 * doesn't have to know about the binding shape. Returns null when:
 *   - the AI binding isn't configured (local dev / preview without binding),
 *   - the call throws (AI overloaded / quota exhausted),
 *   - the response shape is unexpected.
 *
 * Callers MUST treat null as "skip this row" rather than a hard error so a
 * partial outage doesn't break the admin UI.
 */
import type { Env } from '../_helpers'

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
/** bge-base-en-v1.5 emits 768-dim vectors. */
export const EMBEDDING_DIM = 768

interface BgeResponse {
  // Single-input call returns shape `{ data: [number[]], shape: [1, 768] }`.
  data?: number[][]
  shape?: number[]
}

export async function embedText(env: Env, text: string): Promise<Float32Array | null> {
  if (!env.AI) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    // Workers AI typings are loose for cf/baai/* models; cast at the boundary.
    const result = (await env.AI.run(EMBEDDING_MODEL, { text: [trimmed] })) as BgeResponse
    const row = result.data?.[0]
    if (!Array.isArray(row) || row.length !== EMBEDDING_DIM) return null
    return Float32Array.from(row)
  } catch {
    return null
  }
}

/**
 * Embed a batch of texts in one Workers AI call. bge-base-en-v1.5 accepts
 * up to 100 inputs per invocation. Returns null entries for any rows the
 * model couldn't score (preserving alignment with the input array).
 */
export async function embedBatch(env: Env, texts: string[]): Promise<(Float32Array | null)[]> {
  if (!env.AI || texts.length === 0) return texts.map(() => null)
  const trimmed = texts.map((t) => t.trim())
  try {
    const result = (await env.AI.run(EMBEDDING_MODEL, { text: trimmed })) as BgeResponse
    const rows = result.data ?? []
    return trimmed.map((t, i) => {
      if (!t) return null
      const row = rows[i]
      if (!Array.isArray(row) || row.length !== EMBEDDING_DIM) return null
      return Float32Array.from(row)
    })
  } catch {
    return texts.map(() => null)
  }
}
