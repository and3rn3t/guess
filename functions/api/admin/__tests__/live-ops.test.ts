import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildEnv,
  createTestDb,
  invokeHandler,
  type TestDb,
} from './harness'
import { onRequestGet as liveOpsGet } from '../live-ops'

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('GET /api/admin/live-ops', () => {
  it('returns zeros when no recent activity', async () => {
    const env = buildEnv({ db })
    const res = await invokeHandler<{
      games1h: number
      gamesPerMin: number
      errorRate: number | null
      p95LatencyMs: number | null
    }>(liveOpsGet, { env, method: 'GET' })

    expect(res.status).toBe(200)
    expect(res.body.games1h).toBe(0)
    expect(res.body.gamesPerMin).toBe(0)
    expect(res.body.errorRate).toBeNull()
    expect(res.body.p95LatencyMs).toBeNull()
  })

  it('counts recent games and errors', async () => {
    const now = Math.floor(Date.now() / 1000)
    // 3 wins, 1 loss in the last hour; 1 ancient game ignored.
    const insertGame = db.raw.prepare(
      `INSERT INTO game_stats (user_id, won, difficulty, questions_asked, character_pool_size, created_at)
       VALUES (?, ?, 'medium', 0, 0, ?)`,
    )
    insertGame.run('u1', 1, now - 60)
    insertGame.run('u2', 1, now - 120)
    insertGame.run('u3', 1, now - 1800)
    insertGame.run('u4', 0, now - 600)
    insertGame.run('u5', 1, now - 7200) // > 1h ago, ignored

    // 2 errors + 1 warn in the last hour; 1 ancient error ignored.
    const insertLog = db.raw.prepare(
      `INSERT INTO error_logs (level, source, message, created_at) VALUES (?, ?, ?, ?)`,
    )
    insertLog.run('error', 'llm', 'fail', (now - 60) * 1000)
    insertLog.run('error', 'answer', 'fail', (now - 200) * 1000)
    insertLog.run('warn', 'cron', 'slow', (now - 300) * 1000)
    insertLog.run('error', 'old', 'fail', (now - 7200) * 1000)

    const env = buildEnv({ db })
    const res = await invokeHandler<{
      games1h: number
      wins1h: number
      losses1h: number
      errors1h: number
      warns1h: number
      gamesPerMin: number
      errorRate: number | null
      p95LatencyMs: number | null
    }>(liveOpsGet, { env, method: 'GET' })

    expect(res.status).toBe(200)
    expect(res.body.games1h).toBe(4)
    expect(res.body.wins1h).toBe(3)
    expect(res.body.losses1h).toBe(1)
    expect(res.body.errors1h).toBe(2)
    expect(res.body.warns1h).toBe(1)
    expect(res.body.gamesPerMin).toBe(0.07) // 4/60 rounded to 2dp
    expect(res.body.errorRate).toBeCloseTo(0.5, 5)
    expect(res.body.p95LatencyMs).toBeNull() // no AE creds in test env
  })
})
