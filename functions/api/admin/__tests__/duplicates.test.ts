/**
 * B.4 round-trip tests for /api/admin/questions/duplicates/* endpoints.
 *
 * Uses the in-memory D1 harness. AI binding is stubbed to return canned
 * embeddings so the embed batch path is exercised without hitting Workers AI.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import {
  createTestDb,
  createTestKv,
  invokeHandler,
  seedAttributeDefinition,
  type TestDb,
  type TestKv,
} from './harness'
import {
  serializeEmbedding,
  shortTextHash,
  cosineSimilarity,
} from '../_dedup'
import { EMBEDDING_DIM, EMBEDDING_MODEL } from '../_embed'
import {
  onRequestGet as duplicatesGet,
  onRequestPost as duplicatesPostFallback,
} from '../questions/duplicates/_handlers'
import { onRequestPost as backfillPost } from '../questions/duplicates/backfill'
import { onRequestPost as dismissPost } from '../questions/duplicates/dismiss'
import { onRequestPost as mergePost } from '../questions/duplicates/merge'

// ── Test fixtures ────────────────────────────────────────────────────────────

function paddedVec(seed: number): Float32Array {
  // Build a deterministic 768-dim unit vector seeded by `seed` so two seeds
  // give two distinct directions but identical seeds give identical vectors.
  const v = new Float32Array(EMBEDDING_DIM)
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    v[i] = Math.sin((i + 1) * seed * 0.0173)
  }
  // Normalise to unit length so cosine ≡ dot product.
  let mag = 0
  for (const x of v) mag += x * x
  mag = Math.sqrt(mag)
  for (let i = 0; i < v.length; i++) {
    const x = v[i]
    if (x !== undefined) v[i] = x / mag
  }
  return v
}

function resetTables(db: TestDb) {
  db.raw.exec(
    `DELETE FROM question_dedup_dismissed; DELETE FROM attribute_embeddings; DELETE FROM questions;`,
  )
}

function seedQuestion(db: TestDb, key: string, text: string) {
  seedAttributeDefinition(db, key, { question_text: text })
  db.raw
    .prepare(
      `INSERT OR REPLACE INTO questions (id, text, attribute_key) VALUES (?, ?, ?)`,
    )
    .run(`q-${key}`, text, key)
}

function seedEmbedding(db: TestDb, key: string, vec: Float32Array, text: string) {
  const blob = serializeEmbedding(vec)
  db.raw
    .prepare(
      `INSERT OR REPLACE INTO attribute_embeddings
        (attribute_key, embedding, dim, model, text_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      key,
      Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength),
      EMBEDDING_DIM,
      EMBEDDING_MODEL,
      shortTextHash(text),
      Math.floor(Date.now() / 1000),
    )
}

interface MockAi {
  binding: { run: (model: string, input: { text: string[] }) => Promise<unknown> }
  calls: Array<{ model: string; texts: string[] }>
  setVectors: (texts: string[], vectors: (Float32Array | null)[]) => void
}

function makeMockAi(): MockAi {
  const calls: Array<{ model: string; texts: string[] }> = []
  const map = new Map<string, Float32Array | null>()
  return {
    calls,
    setVectors(texts, vectors) {
      texts.forEach((t, i) => map.set(t, vectors[i] ?? null))
    },
    binding: {
      async run(model, input) {
        calls.push({ model, texts: input.text })
        const data = input.text.map((t) => {
          const v = map.get(t)
          return v ? Array.from(v) : new Array<number>(EMBEDDING_DIM).fill(0)
        })
        return { data, shape: [data.length, EMBEDDING_DIM] }
      },
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/admin/questions/duplicates', () => {
  let db: TestDb
  let kv: TestKv
  beforeEach(() => {
    db = createTestDb()
    kv = createTestKv()
    resetTables(db)
  })

  it('returns 503 when the DB binding is missing', async () => {
    const res = await invokeHandler(duplicatesGet, {
      env: { GUESS_DB: undefined as never, GUESS_KV: kv as never } as never,
      method: 'GET',
    })
    expect(res.status).toBe(503)
  })

  it('returns an empty pair list when no embeddings exist', async () => {
    seedQuestion(db, 'isHero', 'Is this character a hero?')
    const res = await invokeHandler<{ pairs: unknown[]; totalQuestions: number; totalEmbedded: number }>(
      duplicatesGet,
      {
        env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
        method: 'GET',
      },
    )
    expect(res.status).toBe(200)
    expect(res.body.pairs).toEqual([])
    expect(res.body.totalEmbedded).toBe(0)
    expect(res.body.totalQuestions).toBe(1)
  })

  it('flags pairs above threshold and excludes dismissed pairs', async () => {
    const v1 = paddedVec(1)
    const v2 = paddedVec(1.0001) // very close to v1 → high cosine
    const v3 = paddedVec(99) // very different
    seedQuestion(db, 'isHero', 'Is this character a hero?')
    seedQuestion(db, 'isProtagonist', 'Is this the protagonist?')
    seedQuestion(db, 'hasHat', 'Does it wear a hat?')
    seedEmbedding(db, 'isHero', v1, 'Is this character a hero?')
    seedEmbedding(db, 'isProtagonist', v2, 'Is this the protagonist?')
    seedEmbedding(db, 'hasHat', v3, 'Does it wear a hat?')

    const sim = cosineSimilarity(v1, v2)
    expect(sim).toBeGreaterThan(0.99)

    const res = await invokeHandler<{ pairs: Array<{ pairKey: string; similarity: number }> }>(
      duplicatesGet,
      {
        env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
        method: 'GET',
        url: 'https://example.com/api/admin/questions/duplicates?threshold=0.95',
      },
    )
    expect(res.status).toBe(200)
    expect(res.body.pairs.length).toBe(1)
    expect(res.body.pairs[0]?.pairKey).toBe('isHero::isProtagonist')

    // Dismiss it, expect the pair to disappear.
    db.raw
      .prepare(
        `INSERT INTO question_dedup_dismissed (pair_key, attribute_key_a, attribute_key_b, similarity)
         VALUES (?, ?, ?, ?)`,
      )
      .run('isHero::isProtagonist', 'isHero', 'isProtagonist', 0.99)
    const res2 = await invokeHandler<{ pairs: unknown[] }>(duplicatesGet, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/duplicates?threshold=0.95',
    })
    expect(res2.body.pairs).toEqual([])
  })

  it('clamps threshold to [0.5, 0.999]', async () => {
    const res = await invokeHandler<{ threshold: number }>(duplicatesGet, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/duplicates?threshold=2.5',
    })
    expect(res.body.threshold).toBe(0.999)
  })
})

describe('POST /api/admin/questions/duplicates fallback', () => {
  it('returns 404 instructing the caller to use a sub-route', async () => {
    const res = await invokeHandler(duplicatesPostFallback, {
      env: {} as never,
      method: 'POST',
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/questions/duplicates/backfill', () => {
  let db: TestDb
  let kv: TestKv
  beforeEach(() => {
    db = createTestDb()
    kv = createTestKv()
    resetTables(db)
  })

  it('returns 503 when the AI binding is missing', async () => {
    seedQuestion(db, 'isHero', 'Is this character a hero?')
    const res = await invokeHandler(backfillPost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'POST',
      body: {},
    })
    expect(res.status).toBe(503)
  })

  it('embeds rows missing an embedding and writes them to the table', async () => {
    seedQuestion(db, 'isHero', 'Is this character a hero?')
    seedQuestion(db, 'hasHat', 'Does it wear a hat?')
    const ai = makeMockAi()
    ai.setVectors(
      ['Is this character a hero?', 'Does it wear a hat?'],
      [paddedVec(1), paddedVec(2)],
    )
    const res = await invokeHandler<{ embedded: number }>(backfillPost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv, AI: ai.binding } as never,
      method: 'POST',
      body: { limit: 10 },
    })
    expect(res.status).toBe(200)
    expect(res.body.embedded).toBe(2)
    const stored = db.raw
      .prepare(`SELECT attribute_key FROM attribute_embeddings ORDER BY attribute_key`)
      .all() as { attribute_key: string }[]
    expect(stored.map((s) => s.attribute_key)).toEqual(['hasHat', 'isHero'])
  })

  it('skips rows whose text_hash is unchanged', async () => {
    seedQuestion(db, 'isHero', 'Is this character a hero?')
    seedEmbedding(db, 'isHero', paddedVec(1), 'Is this character a hero?')
    const ai = makeMockAi()
    const res = await invokeHandler<{ embedded: number }>(backfillPost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv, AI: ai.binding } as never,
      method: 'POST',
      body: { limit: 10 },
    })
    expect(res.status).toBe(200)
    expect(res.body.embedded).toBe(0)
    expect(ai.calls.length).toBe(0)
  })

  it('clamps the limit to [1, 200]', async () => {
    // Just confirming no crash on out-of-range; behaviour covered by clampLimit's range.
    seedQuestion(db, 'isHero', 'Is this character a hero?')
    const ai = makeMockAi()
    ai.setVectors(['Is this character a hero?'], [paddedVec(1)])
    const res = await invokeHandler<{ embedded: number }>(backfillPost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv, AI: ai.binding } as never,
      method: 'POST',
      body: { limit: 9999 },
    })
    expect(res.status).toBe(200)
    expect(res.body.embedded).toBe(1)
  })
})

describe('POST /api/admin/questions/duplicates/dismiss', () => {
  let db: TestDb
  let kv: TestKv
  beforeEach(() => {
    db = createTestDb()
    kv = createTestKv()
    resetTables(db)
  })

  it('rejects requests missing pairKey', async () => {
    const res = await invokeHandler(dismissPost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'POST',
      body: {},
    })
    expect(res.status).toBe(400)
  })

  it('canonicalises pairKey order and persists', async () => {
    const res = await invokeHandler<{ pairKey: string }>(dismissPost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'POST',
      body: { pairKey: 'isVillain::isEvil', similarity: 0.97, reason: 'opposite polarity' },
    })
    expect(res.status).toBe(200)
    expect(res.body.pairKey).toBe('isEvil::isVillain')
    const row = db.raw
      .prepare(`SELECT pair_key, dismissed_by FROM question_dedup_dismissed`)
      .get() as { pair_key: string; dismissed_by: string }
    expect(row.pair_key).toBe('isEvil::isVillain')
    expect(row.dismissed_by).toBe('opposite polarity')
  })
})

describe('POST /api/admin/questions/duplicates/merge', () => {
  let db: TestDb
  let kv: TestKv
  beforeEach(() => {
    db = createTestDb()
    kv = createTestKv()
    resetTables(db)
  })

  it('rejects when source/target equal', async () => {
    const res = await invokeHandler(mergePost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'POST',
      body: { sourceKey: 'isHero', targetKey: 'isHero' },
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when either question is missing', async () => {
    seedQuestion(db, 'isHero', 'Is this a hero?')
    const res = await invokeHandler(mergePost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'POST',
      body: { sourceKey: 'isHero', targetKey: 'isVillain' },
    })
    expect(res.status).toBe(404)
  })

  it('retires the source, auto-dismisses the pair, and busts the KV cache', async () => {
    seedQuestion(db, 'isHero', 'Is this a hero?')
    seedQuestion(db, 'isProtagonist', 'Is this the protagonist?')
    kv._store.set('meta:questions', 'cached')
    const res = await invokeHandler<{ retired: string; target: string }>(mergePost, {
      env: { GUESS_DB: db.d1, GUESS_KV: kv } as never,
      method: 'POST',
      body: { sourceKey: 'isProtagonist', targetKey: 'isHero', reason: 'same idea' },
    })
    expect(res.status).toBe(200)
    expect(res.body.retired).toBe('isProtagonist')
    expect(res.body.target).toBe('isHero')

    const retired = db.raw
      .prepare(`SELECT retired_at, retired_reason FROM questions WHERE attribute_key = ?`)
      .get('isProtagonist') as { retired_at: number; retired_reason: string }
    expect(retired.retired_at).toBeGreaterThan(0)
    expect(retired.retired_reason).toBe('same idea')

    const dismissed = db.raw
      .prepare(`SELECT pair_key FROM question_dedup_dismissed`)
      .get() as { pair_key: string }
    expect(dismissed.pair_key).toBe('isHero::isProtagonist')

    expect(kv._store.has('meta:questions')).toBe(false)
  })
})
