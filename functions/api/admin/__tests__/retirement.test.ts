import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { onRequestGet as onRetirementQueueGet } from '../questions/retirement-queue'
import { onRequestPost as onRetirePost } from '../questions/[key]/retire'
import { onRequestPost as onUnretirePost } from '../questions/[key]/unretire'
import {
  buildEnv,
  createTestDb,
  invokeHandler,
  seedAttributeDefinition,
  type TestDb,
} from './harness'

interface QueueResponse {
  source: 'live' | 'retired'
  windowDays: number
  candidates?: Array<{
    questionId: string
    text: string | null
    shown: number
    skipped: number
    skipRate: number
    maybeRate: number
    imbalance: number
    retirementScore: number
  }>
  retired?: Array<{
    questionId: string
    text: string
    retiredAt: number
    retiredReason: string | null
  }>
}

function seedQuestion(db: TestDb, id: string, attrKey: string, text: string): void {
  seedAttributeDefinition(db, attrKey)
  db.raw
    .prepare(`INSERT OR REPLACE INTO questions (id, text, attribute_key, priority) VALUES (?, ?, ?, ?)`)
    .run(id, text, attrKey, 1.0)
}

function seedAttempt(
  db: TestDb,
  questionId: string,
  attribute: string,
  answer: 'yes' | 'no' | 'maybe' | 'unknown',
  count: number,
  ageSecs = 60,
): void {
  const createdAt = Math.floor(Date.now() / 1000) - ageSecs
  const stmt = db.raw.prepare(
    `INSERT INTO question_attempts
       (session_id, question_id, attribute, answer, question_index, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
  )
  for (let i = 0; i < count; i++) {
    stmt.run(`session-${questionId}-${i}-${answer}`, questionId, attribute, answer, createdAt + i)
  }
}

function seedSkipEvent(db: TestDb, questionId: string, count: number): void {
  const createdAt = Date.now() - 60_000
  const stmt = db.raw.prepare(
    `INSERT INTO client_events (id, event_type, data, created_at) VALUES (?, 'question_skip', ?, ?)`,
  )
  for (let i = 0; i < count; i++) {
    stmt.run(`evt-${questionId}-${i}`, JSON.stringify({ questionId }), createdAt + i)
  }
}

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('GET /api/admin/questions/retirement-queue', () => {
  it('returns empty live queue when no question_attempts exist', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler<QueueResponse>(onRetirementQueueGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/retirement-queue',
    })
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('live')
    expect(res.body.candidates).toEqual([])
  })

  it('ranks worst question first by composite score', async () => {
    // q-skip is the worst: high skip rate dominates score.
    seedQuestion(db, 'q-skip', 'isHero', 'Is the character a hero?')
    seedQuestion(db, 'q-good', 'isHuman', 'Is the character human?')

    // q-skip: shown 10× (5 yes, 5 no), skipped 10× → skipRate=0.5
    seedAttempt(db, 'q-skip', 'isHero', 'yes', 5)
    seedAttempt(db, 'q-skip', 'isHero', 'no', 5)
    seedSkipEvent(db, 'q-skip', 10)

    // q-good: shown 20× (10 yes, 10 no), 0 skips → score = 0
    seedAttempt(db, 'q-good', 'isHuman', 'yes', 10)
    seedAttempt(db, 'q-good', 'isHuman', 'no', 10)

    const env = buildEnv({ db })
    const res = await invokeHandler<QueueResponse>(onRetirementQueueGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/retirement-queue?minShown=5',
    })

    expect(res.status).toBe(200)
    expect(res.body.candidates).toHaveLength(2)
    expect(res.body.candidates![0].questionId).toBe('q-skip')
    expect(res.body.candidates![0].skipRate).toBeCloseTo(0.5, 4)
    expect(res.body.candidates![0].retirementScore).toBeGreaterThan(res.body.candidates![1].retirementScore)
  })

  it('excludes retired questions from the live queue', async () => {
    seedQuestion(db, 'q-1', 'isHero', 'Is hero?')
    seedAttempt(db, 'q-1', 'isHero', 'yes', 5)
    seedAttempt(db, 'q-1', 'isHero', 'no', 5)

    db.raw.prepare(`UPDATE questions SET retired_at = ? WHERE id = ?`).run(Date.now(), 'q-1')

    const env = buildEnv({ db })
    const res = await invokeHandler<QueueResponse>(onRetirementQueueGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/retirement-queue?minShown=5',
    })
    expect(res.body.candidates).toEqual([])
  })

  it('respects minShown to drop low-volume noise', async () => {
    seedQuestion(db, 'q-noise', 'isHero', 'noise?')
    seedAttempt(db, 'q-noise', 'isHero', 'yes', 1)
    seedAttempt(db, 'q-noise', 'isHero', 'no', 1)
    seedSkipEvent(db, 'q-noise', 100) // huge skip → would dominate without minShown

    const env = buildEnv({ db })
    const res = await invokeHandler<QueueResponse>(onRetirementQueueGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/retirement-queue?minShown=10',
    })
    expect(res.body.candidates).toEqual([])
  })

  it('source=retired returns the retired list ordered by retired_at DESC', async () => {
    seedQuestion(db, 'q-old', 'isOld', 'old?')
    seedQuestion(db, 'q-new', 'isNew', 'new?')

    db.raw
      .prepare(`UPDATE questions SET retired_at = ?, retired_reason = ? WHERE id = ?`)
      .run(1000, 'old retire', 'q-old')
    db.raw
      .prepare(`UPDATE questions SET retired_at = ?, retired_reason = ? WHERE id = ?`)
      .run(9000, 'fresh retire', 'q-new')

    const env = buildEnv({ db })
    const res = await invokeHandler<QueueResponse>(onRetirementQueueGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/questions/retirement-queue?source=retired',
    })

    expect(res.body.source).toBe('retired')
    expect(res.body.retired).toHaveLength(2)
    expect(res.body.retired![0].questionId).toBe('q-new')
    expect(res.body.retired![0].retiredReason).toBe('fresh retire')
    expect(res.body.retired![1].questionId).toBe('q-old')
  })
})

describe('POST /api/admin/questions/:key/retire', () => {
  it('marks the question retired', async () => {
    seedQuestion(db, 'q-1', 'isHero', 'Is hero?')

    const env = buildEnv({ db })
    const res = await invokeHandler<{ ok: boolean; retired: number; reason: string | null }>(
      onRetirePost,
      {
        env,
        method: 'POST',
        url: 'https://example.com/api/admin/questions/isHero/retire',
        body: { reason: 'too vague' },
        params: { key: 'isHero' },
      },
    )

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, retired: 1, reason: 'too vague' })

    const row = db.raw
      .prepare(`SELECT retired_at, retired_reason FROM questions WHERE id = ?`)
      .get('q-1') as { retired_at: number; retired_reason: string }
    expect(row.retired_at).toBeGreaterThan(0)
    expect(row.retired_reason).toBe('too vague')
  })

  it('returns 404 when no questions match the key', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler(onRetirePost, {
      env,
      method: 'POST',
      url: 'https://example.com/api/admin/questions/nope/retire',
      body: {},
      params: { key: 'nope' },
    })
    expect(res.status).toBe(404)
  })

  it('rejects oversized reasons', async () => {
    seedQuestion(db, 'q-1', 'isHero', 'Is hero?')
    const env = buildEnv({ db })
    const res = await invokeHandler(onRetirePost, {
      env,
      method: 'POST',
      url: 'https://example.com/api/admin/questions/isHero/retire',
      body: { reason: 'x'.repeat(501) },
      params: { key: 'isHero' },
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/questions/:key/unretire', () => {
  it('clears retired_at + retired_reason', async () => {
    seedQuestion(db, 'q-1', 'isHero', 'Is hero?')
    db.raw
      .prepare(`UPDATE questions SET retired_at = ?, retired_reason = 'old' WHERE id = ?`)
      .run(Date.now(), 'q-1')

    const env = buildEnv({ db })
    const res = await invokeHandler<{ ok: boolean; unretired: number }>(onUnretirePost, {
      env,
      method: 'POST',
      url: 'https://example.com/api/admin/questions/isHero/unretire',
      params: { key: 'isHero' },
    })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, unretired: 1 })

    const row = db.raw
      .prepare(`SELECT retired_at, retired_reason FROM questions WHERE id = ?`)
      .get('q-1') as { retired_at: number | null; retired_reason: string | null }
    expect(row.retired_at).toBeNull()
    expect(row.retired_reason).toBeNull()
  })

  it('returns 404 for unknown key', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler(onUnretirePost, {
      env,
      method: 'POST',
      url: 'https://example.com/api/admin/questions/nope/unretire',
      params: { key: 'nope' },
    })
    expect(res.status).toBe(404)
  })
})
