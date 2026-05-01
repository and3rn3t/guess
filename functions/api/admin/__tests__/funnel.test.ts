import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildEnv, createTestDb, invokeHandler, type TestDb } from './harness'
import { onRequestGet as funnelGet } from '../funnel'

interface PerQuestionRow {
  questionId: string
  text: string | null
  shown: number
  skipped: number
  yes: number
  no: number
  maybe: number
  unknown: number
  skipRate: number
  maybeRate: number
  frustrationScore: number
}

interface FunnelResp {
  windowDays: number
  totals: {
    gameStarts: number
    gameEnds: number
    gameAbandons: number
    questionSkips: number
    completionRate: number
    abandonRate: number
    avgSkipsPerGame: number
  }
  perQuestion: PerQuestionRow[]
}

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('GET /api/admin/funnel — AN.1 per-question signals', () => {
  it('returns empty perQuestion when there is no traffic', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler<FunnelResp>(funnelGet, { env, method: 'GET' })
    expect(res.status).toBe(200)
    expect(res.body.perQuestion).toEqual([])
    expect(res.body.totals.questionSkips).toBe(0)
  })

  it('aggregates question_attempts + question_skip events into a sortable leaderboard', async () => {
    const nowSecs = Math.floor(Date.now() / 1000)
    const nowMs = nowSecs * 1000

    // Seed the questions that will be referenced. Schema: id, text, attribute_key, priority.
    // attribute_key references attribute_definitions; seed those first to satisfy FK.
    const insertAttrDef = db.raw.prepare(
      `INSERT OR IGNORE INTO attribute_definitions (key, display_text) VALUES (?, ?)`,
    )
    insertAttrDef.run('isHuman', 'Is Human')
    insertAttrDef.run('wieldsKatana', 'Wields Katana')
    const insertQ = db.raw.prepare(
      `INSERT OR IGNORE INTO questions (id, text, attribute_key) VALUES (?, ?, ?)`,
    )
    insertQ.run('q-easy', 'Is the character human?', 'isHuman')
    insertQ.run('q-hard', 'Does the character wield a katana?', 'wieldsKatana')

    // Seed question_attempts: q-easy is calm (10 shown, 0 maybe), q-hard is
    // frustrating (10 shown, 5 maybe). Created_at is unix seconds.
    const insertAttempt = db.raw.prepare(
      `INSERT INTO question_attempts
        (session_id, question_id, attribute, answer, question_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (let i = 0; i < 10; i++) {
      insertAttempt.run('s1', 'q-easy', 'isHuman', i % 2 === 0 ? 'yes' : 'no', i, nowSecs - 60)
    }
    for (let i = 0; i < 10; i++) {
      const ans = i < 5 ? 'maybe' : 'yes'
      insertAttempt.run('s2', 'q-hard', 'wieldsKatana', ans, i, nowSecs - 60)
    }

    // Seed 3 question_skip events targeting q-hard. created_at is unix ms.
    const insertEvent = db.raw.prepare(
      `INSERT INTO client_events (id, session_id, user_id, event_type, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    insertEvent.run(
      'e1',
      's2',
      'u1',
      'question_skip',
      JSON.stringify({ questionId: 'q-hard', questionsAsked: 3 }),
      nowMs - 60_000,
    )
    insertEvent.run(
      'e2',
      's3',
      'u2',
      'question_skip',
      JSON.stringify({ questionId: 'q-hard', questionsAsked: 4 }),
      nowMs - 30_000,
    )
    insertEvent.run(
      'e3',
      's4',
      'u3',
      'question_skip',
      JSON.stringify({ questionId: 'q-hard', questionsAsked: 5 }),
      nowMs - 10_000,
    )

    const env = buildEnv({ db })
    const res = await invokeHandler<FunnelResp>(funnelGet, { env, method: 'GET' })

    expect(res.status).toBe(200)
    expect(res.body.totals.questionSkips).toBe(3)
    expect(res.body.perQuestion).toHaveLength(2)

    // q-hard sorts first (higher frustration score).
    const [first, second] = res.body.perQuestion
    expect(first.questionId).toBe('q-hard')
    expect(first.text).toBe('Does the character wield a katana?')
    expect(first.shown).toBe(10)
    expect(first.skipped).toBe(3)
    expect(first.maybe).toBe(5)
    // skipRate = 3/13 ≈ 0.2308; maybeRate = 5/10 = 0.5
    // frustrationScore = 0.6 × 0.2308 + 0.4 × 0.5 = 0.3385
    expect(first.skipRate).toBeCloseTo(0.2308, 4)
    expect(first.maybeRate).toBe(0.5)
    expect(first.frustrationScore).toBeCloseTo(0.3385, 4)

    expect(second.questionId).toBe('q-easy')
    expect(second.skipped).toBe(0)
    expect(second.maybeRate).toBe(0)
    expect(second.frustrationScore).toBe(0)
  })

  it('drops questions below the minShown=5 threshold', async () => {
    const nowSecs = Math.floor(Date.now() / 1000)
    db.raw.prepare(
      `INSERT OR IGNORE INTO attribute_definitions (key, display_text) VALUES (?, ?)`,
    ).run('niche', 'Niche')
    db.raw.prepare(
      `INSERT OR IGNORE INTO questions (id, text, attribute_key) VALUES (?, ?, ?)`,
    ).run('q-rare', 'Niche?', 'niche')

    const insertAttempt = db.raw.prepare(
      `INSERT INTO question_attempts
        (session_id, question_id, attribute, answer, question_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    // Only 3 shown — should be filtered out.
    for (let i = 0; i < 3; i++) {
      insertAttempt.run('s1', 'q-rare', 'niche', 'yes', i, nowSecs - 60)
    }

    const env = buildEnv({ db })
    const res = await invokeHandler<FunnelResp>(funnelGet, { env, method: 'GET' })
    expect(res.body.perQuestion).toEqual([])
  })
})
