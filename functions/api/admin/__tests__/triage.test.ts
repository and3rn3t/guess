import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildEnv, createTestDb, invokeHandler, type TestDb } from './harness'
import { onRequestGet as triageGet } from '../triage'

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('GET /api/admin/triage — AN.21 catastrophic-failure queue', () => {
  it('returns empty list when queue is empty', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler<{ rows: unknown[]; total: number }>(triageGet, { env, method: 'GET', url: 'https://example.com/api/admin/triage' })
    expect(res.status).toBe(200)
    expect(res.body.rows).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('returns inserted rows in created_at DESC order', async () => {
    db.raw
      .prepare(
        `INSERT INTO triage_queue (actual_character_id, actual_character_name, min_rank, steps_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('char-a', 'Alice', null, '[]', Date.now() - 1000)
    db.raw
      .prepare(
        `INSERT INTO triage_queue (actual_character_id, actual_character_name, min_rank, steps_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('char-b', 'Bob', null, '[]', Date.now())

    const env = buildEnv({ db })
    const res = await invokeHandler<{ rows: Array<{ actual_character_id: string }>; total: number }>(
      triageGet,
      { env, method: 'GET', url: 'https://example.com/api/admin/triage' }
    )
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    // Most recent first
    expect(res.body.rows[0].actual_character_id).toBe('char-b')
    expect(res.body.rows[1].actual_character_id).toBe('char-a')
  })

  it('returns a single detail row by id with parsed steps', async () => {
    const steps = [{ attr: 'isMale', answer: 'yes', questionText: 'Is male?', top10: [{ id: 'x', name: 'X' }] }]
    const result = db.raw
      .prepare(
        `INSERT INTO triage_queue (actual_character_id, actual_character_name, min_rank, steps_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('char-a', 'Alice', null, JSON.stringify(steps), Date.now())
    const insertedId = result.lastInsertRowid as number

    const env = buildEnv({ db })
    const res = await invokeHandler<{
      id: number
      actualCharacterId: string
      steps: typeof steps
    }>(triageGet, { env, method: 'GET', url: `https://example.com/api/admin/triage?id=${insertedId}` })

    expect(res.status).toBe(200)
    expect(res.body.actualCharacterId).toBe('char-a')
    expect(res.body.steps).toHaveLength(1)
    expect(res.body.steps[0].attr).toBe('isMale')
    expect(res.body.steps[0].top10).toEqual([{ id: 'x', name: 'X' }])
  })

  it('returns 404 for unknown id', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler(triageGet, { env, method: 'GET', url: 'https://example.com/api/admin/triage?id=9999' })
    expect(res.status).toBe(404)
  })

  it('respects limit and offset params', async () => {
    const insert = db.raw.prepare(
      `INSERT INTO triage_queue (actual_character_id, min_rank, steps_json, created_at) VALUES (?, ?, ?, ?)`
    )
    for (let i = 0; i < 5; i++) insert.run(`char-${i}`, null, '[]', Date.now() + i)

    const env = buildEnv({ db })
    const res = await invokeHandler<{ rows: unknown[]; total: number; limit: number; offset: number }>(
      triageGet,
      { env, method: 'GET', url: 'https://example.com/api/admin/triage?limit=2&offset=1' }
    )
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(5)
    expect(res.body.rows).toHaveLength(2)
    expect(res.body.limit).toBe(2)
    expect(res.body.offset).toBe(1)
  })
})
