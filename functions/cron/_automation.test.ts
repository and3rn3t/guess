import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, seedAttributeDefinition, type TestDb } from '../api/admin/__tests__/harness'
import { runAdminAutomation } from './_automation'
import { CLOSURE_QUEUE_REPORT_KEY } from '../api/admin/data-quality/_closure_queue'
import { SOURCE_HEALTH_REPORT_KEY } from '../api/_source_health'

let db: TestDb

beforeEach(() => {
  db = createTestDb()
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
      AUTO_DUPLICATES_BACKFILL: '0',
      AUTO_ENRICH_ONE: '0',
      AUTO_CLOSURE_QUEUE: '0',
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

    const reportRow = db.raw.prepare("SELECT value FROM kv_cache WHERE key = 'admin:automation:last-run'").get() as { value: string } | null
    const reportRaw = reportRow ? JSON.parse(reportRow.value) as { snapshot: string } : null
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
      AUTO_CAPTURE_DQ_SNAPSHOT: '0',
      AUTO_DUPLICATES_BACKFILL: '0',
      AUTO_ENRICH_ONE: '0',
      AUTO_CLOSURE_QUEUE: '0',
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

  it('materializes the source-health report to KV when enabled', async () => {
    db.raw
      .prepare(`INSERT INTO characters (id, name, category, source, source_id, popularity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('src-1', 'Source Good', 'movies', 'tmdb', '101', 0.9, Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60)
    db.raw
      .prepare(`INSERT INTO characters (id, name, category, source, source_id, popularity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('src-2', 'Source Missing', 'anime', 'tmdb', '', 0.8, Math.floor(Date.now() / 1000) - 4 * 24 * 60 * 60)

    const trigger = { cron: '5 0 * * *', scheduledTime: Date.now() }
    const env = {
      GUESS_DB: db.d1 as unknown as D1Database,
      AUTO_CAPTURE_DQ_SNAPSHOT: '0',
      AUTO_DUPLICATES_BACKFILL: '0',
      AUTO_ENRICH_ONE: '0',
      AUTO_RETIRE_ENABLED: '0',
      AUTO_CLOSURE_QUEUE: '0',
      AUTO_SOURCE_HEALTH: '1',
      AUTO_SOURCE_HEALTH_LIMIT: '50',
    }

    const summary = await runAdminAutomation(trigger, env, () => {})
    expect(summary.sourceHealth.status).toBe('generated')
    expect(summary.sourceHealth.totalCharacters).toBeGreaterThanOrEqual(2)
    expect(summary.sourceHealth.issueCount).toBeGreaterThan(0)

    const reportRow = db.raw.prepare('SELECT value FROM kv_cache WHERE key = ?').get(SOURCE_HEALTH_REPORT_KEY) as { value: string } | null
    expect(reportRow).not.toBeNull()
    const report = reportRow ? JSON.parse(reportRow.value) as { totals?: { issueCount?: number; totalCharacters?: number; validCharacters?: number } } : null
    expect(report?.totals?.totalCharacters).toBeGreaterThanOrEqual(2)
    expect(report?.totals?.issueCount).toBeGreaterThan(0)
  })

  it('materializes the closure queue report to KV when enabled', async () => {
    seedAttributeDefinition(db, 'isHuman')
    seedAttributeDefinition(db, 'firstAppearedYear')
    seedAttributeDefinition(db, 'personality')

    db.raw
      .prepare(`INSERT INTO characters (id, name, category, source, popularity, created_at) VALUES (?, ?, ?, 'default', ?, ?)`)
      .run('anime-1', 'Alpha', 'anime', 1, Math.floor(Date.now() / 1000) - 45 * 24 * 60 * 60)

    db.raw
      .prepare(`INSERT INTO questions (id, text, attribute_key) VALUES (?, ?, ?)`)
      .run('q-human', 'Is the character human?', 'isHuman')

    db.raw
      .prepare(
        `INSERT INTO question_attempts (session_id, question_id, attribute, answer, question_index, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
      )
      .run('sess-closure-1', 'q-human', 'isHuman', 'yes', Math.floor(Date.now() / 1000) - 60)

    const trigger = { cron: '5 0 * * *', scheduledTime: Date.now() }
    const env = {
      GUESS_DB: db.d1 as unknown as D1Database,
      AUTO_CAPTURE_DQ_SNAPSHOT: '1',
      AUTO_DUPLICATES_BACKFILL: '0',
      AUTO_ENRICH_ONE: '0',
      AUTO_RETIRE_ENABLED: '0',
      AUTO_CLOSURE_QUEUE: '1',
      AUTO_CLOSURE_QUEUE_LIMIT: '50',
    }

    const summary = await runAdminAutomation(trigger, env, () => {})
    expect(summary.closureQueue.status).toBe('generated')
    expect(summary.closureQueue.totalCandidatePairs).toBeGreaterThan(0)
    expect(summary.closureQueue.totalPairs).toBeGreaterThan(0)

    const reportRow = db.raw.prepare('SELECT value FROM kv_cache WHERE key = ?').get(CLOSURE_QUEUE_REPORT_KEY) as { value: string } | null
    expect(reportRow).not.toBeNull()
    const report = reportRow ? JSON.parse(reportRow.value) as { summary?: { totalPairs?: number }; totalCandidatePairs?: number; queue?: Array<{ characterName: string }> } : null
    expect(report?.totalCandidatePairs).toBeGreaterThan(0)
    expect(report?.summary?.totalPairs).toBeGreaterThan(0)
    expect(report?.queue?.[0]?.characterName).toBe('Alpha')

    const snapshotRow = db.raw
      .prepare(
        `SELECT closure_total_pairs, closure_automation_pairs, closure_manual_pairs
           FROM data_quality_snapshots
          ORDER BY captured_at DESC
          LIMIT 1`,
      )
      .get() as {
      closure_total_pairs: number | null
      closure_automation_pairs: number | null
      closure_manual_pairs: number | null
    }
    expect(snapshotRow.closure_total_pairs).toBeGreaterThan(0)
    expect(snapshotRow.closure_automation_pairs ?? 0).toBeGreaterThanOrEqual(0)
    expect(snapshotRow.closure_manual_pairs ?? 0).toBeGreaterThanOrEqual(0)
  })
})
