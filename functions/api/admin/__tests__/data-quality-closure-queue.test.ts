import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { onRequestGet as onClosureQueueGet } from '../data-quality/closure-queue'
import {
  buildEnv,
  createTestDb,
  invokeHandler,
  seedAttributeDefinition,
  seedCharacter,
  type TestDb,
} from './harness'

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('GET /api/admin/data-quality/closure-queue', () => {
  it('returns a deterministic queue summary and ranked pairs', async () => {
    seedAttributeDefinition(db, 'isHuman')
    seedAttributeDefinition(db, 'firstAppearedYear')
    seedAttributeDefinition(db, 'personality')

    seedCharacter(db, 'anime-1', { name: 'Alpha', category: 'anime' })
    seedCharacter(db, 'anime-2', { name: 'Beta', category: 'anime' })

    db.raw
      .prepare(`UPDATE characters SET popularity = ? WHERE id = ?`)
      .run(1, 'anime-1')
    db.raw
      .prepare(`UPDATE characters SET popularity = ? WHERE id = ?`)
      .run(0.6, 'anime-2')
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
    db.raw
      .prepare(`UPDATE characters SET created_at = ? WHERE id = ?`)
      .run(thirtyDaysAgo, 'anime-1')
    db.raw
      .prepare(`UPDATE characters SET created_at = ? WHERE id = ?`)
      .run(thirtyDaysAgo, 'anime-2')

    db.raw
      .prepare(`INSERT INTO questions (id, text, attribute_key) VALUES (?, ?, ?)`)
      .run('q-human', 'Is the character human?', 'isHuman')

    const nowSecs = Math.floor(Date.now() / 1000)
    db.raw
      .prepare(
        `INSERT INTO question_attempts (session_id, question_id, attribute, answer, question_index, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('session-1', 'q-human', 'isHuman', 'yes', 0, nowSecs - 60)

    // Mark one cell already filled so the queue does not become fully symmetric.
    db.raw
      .prepare(
        `INSERT INTO character_attributes (character_id, attribute_key, value, confidence, evidence)
         VALUES (?, ?, 1, 1, 'seed:test')`,
      )
      .run('anime-1', 'isHuman')

    const env = buildEnv({ db })
    const res = await invokeHandler<{
      totalCandidatePairs: number
      summary: {
        totalPairs: number
        automationPairs: number
        manualPairs: number
      }
      queue: Array<{ characterName: string; attributeKey: string; lane: string }>
    }>(onClosureQueueGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/data-quality/closure-queue?limit=10',
    })

    expect(res.status).toBe(200)
    expect(res.body.totalCandidatePairs).toBeGreaterThan(0)
    expect(res.body.summary.totalPairs).toBeGreaterThan(0)
    expect(res.body.summary.automationPairs + res.body.summary.manualPairs).toBe(
      res.body.summary.totalPairs,
    )
    expect(res.body.queue.length).toBeLessThanOrEqual(10)
    expect(res.body.queue[0]).toBeDefined()
    expect(['isHuman', 'firstAppearedYear', 'personality']).toContain(
      res.body.queue[0].attributeKey,
    )
  })
})