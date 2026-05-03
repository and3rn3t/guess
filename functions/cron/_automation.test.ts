import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestKv, seedAttributeDefinition, type TestDb, type TestKv } from '../api/admin/__tests__/harness'
import { runAdminAutomation } from './_automation'

let db: TestDb
let kv: TestKv

beforeEach(() => {
  db = createTestDb()
  kv = createTestKv()
})

afterEach(() => {
  db.close()
})

function seedQuestion(id: string, attrKey: string, text: string): void {
  seedAttributeDefinition(db, attrKey)
  db.raw
    .prepare(`INSERT OR REPLACE INTO questions (id, text, attribute_key, priority) VALUES (?, ?, ?, ?)`)
    .run(id, text, attrKey, 1)
}

function seedAttempt(
  questionId: string,
  attribute: string,
  answer: 'yes' | 'no' | 'maybe' | 'unknown',
  count: number,
): void {
  const createdAt = Math.floor(Date.now() / 1000) - 60
  const stmt = db.raw.prepare(
    `INSERT INTO question_attempts
       (session_id, question_id, attribute, answer, question_index, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
  )
  for (let i = 0; i < count; i++) {
    stmt.run(`sess-${questionId}-${answer}-${i}`, questionId, attribute, answer, createdAt + i)
  }
}

function seedSkip(questionId: string, count: number): void {
  const createdAt = Date.now() - 60_000
  const stmt = db.raw.prepare(
    `INSERT INTO client_events (id, event_type, data, created_at) VALUES (?, 'question_skip', ?, ?)`,
  )
  for (let i = 0; i < count; i++) {
    stmt.run(`evt-${questionId}-${i}`, JSON.stringify({ questionId }), createdAt + i)
  }
}

describe('runAdminAutomation', () => {
  it('captures one snapshot per day and persists run report', async () => {
    const trigger = { cron: '5 0 * * *', scheduledTime: Date.now() }
    const env = {
      GUESS_DB: db.d1 as unknown as D1Database,
      GUESS_KV: kv as unknown as KVNamespace,
      AUTO_DUPLICATES_BACKFILL: '0',
      AUTO_ENRICH_ONE: '0',
      AUTO_RETIRE_ENABLED: '0',
    }

    const first = await runAdminAutomation(trigger, env, () => {})
    expect(first.snapshot).toBe('inserted')

    const countAfterFirst = db.raw
      .prepare('SELECT COUNT(*) AS n FROM data_quality_snapshots')
      .get() as { n: number }
    expect(countAfterFirst.n).toBe(1)

    const second = await runAdminAutomation(trigger, env, () => {})
    expect(second.snapshot).toBe('skipped')

    const countAfterSecond = db.raw
      .prepare('SELECT COUNT(*) AS n FROM data_quality_snapshots')
      .get() as { n: number }
    expect(countAfterSecond.n).toBe(1)

    const reportRaw = await kv.get('admin:automation:last-run', 'json') as { snapshot: string } | null
    expect(reportRaw?.snapshot).toBe('skipped')
  })

  it('can auto-retire high skip-rate questions when explicitly enabled', async () => {
    seedQuestion('q-vague', 'isLegendary', 'Is the character legendary?')
    seedAttempt('q-vague', 'isLegendary', 'yes', 10)
    seedAttempt('q-vague', 'isLegendary', 'no', 10)
    seedSkip('q-vague', 20)

    const trigger = { cron: '5 0 * * *', scheduledTime: Date.now() }
    const env = {
      GUESS_DB: db.d1 as unknown as D1Database,
      GUESS_KV: kv as unknown as KVNamespace,
      AUTO_CAPTURE_DQ_SNAPSHOT: '0',
      AUTO_DUPLICATES_BACKFILL: '0',
      AUTO_ENRICH_ONE: '0',
      AUTO_RETIRE_ENABLED: '1',
      AUTO_RETIRE_LIMIT: '1',
      AUTO_RETIRE_MIN_SHOWN: '10',
      AUTO_RETIRE_MIN_SCORE: '0.15',
    }

    const summary = await runAdminAutomation(trigger, env, () => {})
    expect(summary.retiredQuestions).toBeGreaterThan(0)

    const row = db.raw
      .prepare('SELECT retired_at, retired_reason FROM questions WHERE id = ?')
      .get('q-vague') as { retired_at: number | null; retired_reason: string | null }

    expect(row.retired_at).not.toBeNull()
    expect(row.retired_reason).toContain('auto-retire:')
  })

  it('notes missing DB and still returns a valid summary', async () => {
    const trigger = { cron: '5 0 * * *', scheduledTime: Date.now() }
    const summary = await runAdminAutomation(trigger, {}, () => {})
    expect(summary.snapshot).toBe('skipped')
    expect(summary.notes).toContain('automation skipped: DB unavailable')
  })
})
