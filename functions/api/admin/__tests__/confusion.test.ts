import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildEnv, createTestDb, invokeHandler, type TestDb } from './harness'
import { onRequestGet as confusionGet } from '../confusion'

interface ConfusionPair {
  targetId: string
  targetName: string
  confusedWithId: string
  confusedWithName: string
  confusionCount: number
  winPct: number | null
  lastSeen: number | null
}

interface ConfusionResp {
  source: 'real' | 'sim'
  pairs: ConfusionPair[]
  total: number
  generatedAt: number
  message?: string
}

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

const seedCharacters = () => {
  const insert = db.raw.prepare(
    `INSERT OR IGNORE INTO characters (id, name, category) VALUES (?, ?, ?)`,
  )
  insert.run('naruto', 'Naruto Uzumaki', 'anime')
  insert.run('sasuke', 'Sasuke Uchiha', 'anime')
  insert.run('luffy', 'Monkey D. Luffy', 'anime')
  insert.run('zoro', 'Roronoa Zoro', 'anime')
}

describe('GET /api/admin/confusion — AN.7', () => {
  it('defaults to source=real and returns the empty-state message when no data exists', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler<ConfusionResp>(confusionGet, { env, method: 'GET' })
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('real')
    expect(res.body.pairs).toEqual([])
    expect(res.body.total).toBe(0)
    expect(res.body.message).toContain('No real-game confusion data')
  })

  it('reads pairs from character_confusions joined to characters, sorted by count', async () => {
    seedCharacters()
    const insert = db.raw.prepare(
      `INSERT INTO character_confusions (character_a, character_b, confusion_count, last_seen)
       VALUES (?, ?, ?, ?)`,
    )
    // canonical: a < b lexicographically
    insert.run('luffy', 'zoro', 4, 1_714_000_000_000)
    insert.run('naruto', 'sasuke', 12, 1_714_500_000_000)

    const env = buildEnv({ db })
    const res = await invokeHandler<ConfusionResp>(confusionGet, { env, method: 'GET' })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('real')
    expect(res.body.total).toBe(2)
    expect(res.body.pairs).toHaveLength(2)
    expect(res.body.pairs[0]).toMatchObject({
      targetId: 'naruto',
      targetName: 'Naruto Uzumaki',
      confusedWithId: 'sasuke',
      confusedWithName: 'Sasuke Uchiha',
      confusionCount: 12,
      winPct: null,
      lastSeen: 1_714_500_000_000,
    })
    expect(res.body.pairs[1].confusionCount).toBe(4)
  })

  it('honours minConfusions when filtering real pairs', async () => {
    seedCharacters()
    const insert = db.raw.prepare(
      `INSERT INTO character_confusions (character_a, character_b, confusion_count, last_seen)
       VALUES (?, ?, ?, ?)`,
    )
    insert.run('luffy', 'zoro', 1, 1_714_000_000_000)
    insert.run('naruto', 'sasuke', 5, 1_714_500_000_000)

    const env = buildEnv({ db })
    const res = await invokeHandler<ConfusionResp>(confusionGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/confusion?minConfusions=3',
    })
    expect(res.status).toBe(200)
    expect(res.body.pairs).toHaveLength(1)
    expect(res.body.pairs[0].targetId).toBe('naruto')
  })

  it('falls back to the id when the characters join misses', async () => {
    const insert = db.raw.prepare(
      `INSERT INTO character_confusions (character_a, character_b, confusion_count, last_seen)
       VALUES (?, ?, ?, ?)`,
    )
    insert.run('ghost-a', 'ghost-b', 7, 1_714_000_000_000)

    const env = buildEnv({ db })
    const res = await invokeHandler<ConfusionResp>(confusionGet, { env, method: 'GET' })
    expect(res.status).toBe(200)
    expect(res.body.pairs[0]).toMatchObject({
      targetName: 'ghost-a',
      confusedWithName: 'ghost-b',
    })
  })

  it('source=sim returns the legacy directional shape with winPct populated', async () => {
    const insert = db.raw.prepare(
      `INSERT INTO sim_game_stats
        (run_id, target_character_id, target_character_name, won, questions_asked,
         second_best_character_id, second_best_character_name, difficulty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const now = Date.now()
    // 3 sim games for naruto vs sasuke: 2 wins, 1 loss.
    insert.run('r1', 'naruto', 'Naruto', 1, 12, 'sasuke', 'Sasuke', 'medium', now)
    insert.run('r1', 'naruto', 'Naruto', 1, 14, 'sasuke', 'Sasuke', 'medium', now)
    insert.run('r1', 'naruto', 'Naruto', 0, 20, 'sasuke', 'Sasuke', 'medium', now)

    const env = buildEnv({ db })
    const res = await invokeHandler<ConfusionResp>(confusionGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/confusion?source=sim&minConfusions=2',
    })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('sim')
    expect(res.body.pairs).toHaveLength(1)
    expect(res.body.pairs[0]).toMatchObject({
      targetId: 'naruto',
      confusedWithId: 'sasuke',
      confusionCount: 3,
      winPct: 66.7,
      lastSeen: null,
    })
  })

  it('source=sim returns the simulator empty-state message when no rows exist', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler<ConfusionResp>(confusionGet, {
      env,
      method: 'GET',
      url: 'https://example.com/api/admin/confusion?source=sim',
    })
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('sim')
    expect(res.body.pairs).toEqual([])
    expect(res.body.message).toContain('No simulation data')
  })
})
