/**
 * B.4 — pure helpers for question dedup via embeddings.
 *
 * Kept in a separate module so the math is unit-testable without touching
 * the Workers AI binding. The endpoints in `./questions/duplicates.ts`
 * compose these.
 */

/**
 * Cosine similarity in `[-1, 1]`. Returns 0 for zero-magnitude inputs
 * (defensive — Workers AI shouldn't ever return them but a corrupt blob can).
 * Throws on length mismatch since silently truncating would mask schema drift.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cosine length mismatch: ${a.length} vs ${b.length}`)
  }
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    magA += x * x
    magB += y * y
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

/**
 * Pack a Float32Array into a Uint8Array suitable for D1 BLOB storage.
 * Endianness is whatever the host runtime uses — Workers run on x64/arm64
 * (both little-endian) so this is stable in practice; we record `dim`
 * separately to detect any future drift.
 */
export function serializeEmbedding(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength)
}

/**
 * Unpack a BLOB (as a Uint8Array or ArrayBuffer) back into a Float32Array.
 * D1's `.all()` returns BLOBs as ArrayBuffer; the SQLite test harness
 * returns Uint8Array — handle both.
 */
export function deserializeEmbedding(blob: ArrayBuffer | Uint8Array): Float32Array {
  if (blob instanceof Uint8Array) {
    // Copy because the underlying buffer may not be 4-byte aligned.
    const aligned = new ArrayBuffer(blob.byteLength)
    new Uint8Array(aligned).set(blob)
    return new Float32Array(aligned)
  }
  return new Float32Array(blob)
}

export interface QuestionVector {
  attributeKey: string
  text: string
  embedding: Float32Array
}

export interface DuplicatePair {
  attributeKeyA: string
  attributeKeyB: string
  textA: string
  textB: string
  similarity: number
  /** Canonical pair key for the dismissed table (a < b lexicographically). */
  pairKey: string
}

/**
 * Find all pairs of questions with cosine similarity ≥ `threshold`.
 * Sorted by descending similarity, ties broken by `pairKey` for stability.
 * Skips pairs in `dismissed`.
 *
 * O(n²) is fine for the question table (~hundreds of rows). Switch to
 * Vectorize ANN if it ever crosses ~10k.
 */
export function findDuplicatePairs(
  vectors: QuestionVector[],
  threshold: number,
  dismissed: ReadonlySet<string> = new Set(),
): DuplicatePair[] {
  const pairs: DuplicatePair[] = []
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const a = vectors[i]!
      const b = vectors[j]!
      const sim = cosineSimilarity(a.embedding, b.embedding)
      if (sim < threshold) continue

      const [first, second] =
        a.attributeKey < b.attributeKey ? [a, b] : [b, a]
      const pairKey = `${first.attributeKey}::${second.attributeKey}`
      if (dismissed.has(pairKey)) continue

      pairs.push({
        attributeKeyA: first.attributeKey,
        attributeKeyB: second.attributeKey,
        textA: first.text,
        textB: second.text,
        similarity: Number(sim.toFixed(4)),
        pairKey,
      })
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity || x.pairKey.localeCompare(y.pairKey))
  return pairs
}

/** Build the canonical pair key used in `question_dedup_dismissed`. */
export function canonicalPairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

/**
 * FNV-1a 32-bit hash → 8-char hex. Used to detect when a question's text has
 * changed since its last embedding so we know to refresh — full SHA-256 would
 * be overkill for "did this string change". Same string → same hex.
 */
export function shortTextHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
