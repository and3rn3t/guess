import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildEnv, createTestDb, invokeHandler, type TestDb } from './harness'
import { onRequestGet as analyticsGet } from '../analytics'

interface AnalyticsResponse {
  events: Array<{ id: string; event_type: string }>
  total: number
  page: number
  pageSize: number
  summary: Array<{ event_type: string; count: number }>
  filters: {
    eventType: string
    q: string
    days: number
  }
  aggregates: {
    uniqueSessions: number
    uniqueUsers: number
  }
}

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('GET /api/admin/analytics', () => {
  it('returns 503 when DB is missing', async () => {
    const res = await invokeHandler(analyticsGet, {
      method: 'GET',
      env: buildEnv(),
    })

    expect(res.status).toBe(503)
  })

  it('applies event_type, q, and days filters to events, summary, and aggregates', async () => {
    const now = Date.now()
    const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000

    const insertEvent = db.raw.prepare(
      `INSERT INTO client_events (id, session_id, user_id, event_type, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    insertEvent.run('e1', 's1', 'u1', 'game_start', '{"step":"start"}', now)
    insertEvent.run('e2', 's1', 'u1', 'guess', '{"choice":"mario"}', now)
    insertEvent.run('e3', 's2', 'u2', 'share', '{"target":"twitter"}', now)
    insertEvent.run('e4', 's3', 'u3', 'guess', '{"choice":"luigi"}', fortyDaysAgo)

    const res = await invokeHandler<AnalyticsResponse>(analyticsGet, {
      method: 'GET',
      url: 'https://example.com/api/admin/analytics?event_type=guess&q=mario&days=30&page=1&pageSize=25',
      env: buildEnv({ db }),
    })

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0]?.id).toBe('e2')
    expect(res.body.summary).toEqual([{ event_type: 'guess', count: 1 }])
    expect(res.body.filters).toEqual({ eventType: 'guess', q: 'mario', days: 30 })
    expect(res.body.aggregates.uniqueSessions).toBe(1)
    expect(res.body.aggregates.uniqueUsers).toBe(1)
  })

  it('clamps and defaults query params', async () => {
    const now = Date.now()
    const twoHundredDaysAgo = now - 200 * 24 * 60 * 60 * 1000

    const insertEvent = db.raw.prepare(
      `INSERT INTO client_events (id, session_id, user_id, event_type, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    insertEvent.run('e-now', 's-now', 'u-now', 'guess', '{"k":"v"}', now)
    insertEvent.run('e-old', 's-old', 'u-old', 'guess', '{"k":"old"}', twoHundredDaysAgo)

    const clamped = await invokeHandler<AnalyticsResponse>(analyticsGet, {
      method: 'GET',
      url: 'https://example.com/api/admin/analytics?days=999&page=0&pageSize=999',
      env: buildEnv({ db }),
    })

    expect(clamped.status).toBe(200)
    expect(clamped.body.filters.days).toBe(365)
    expect(clamped.body.page).toBe(1)
    expect(clamped.body.pageSize).toBe(100)
    expect(clamped.body.total).toBe(2)

    const defaulted = await invokeHandler<AnalyticsResponse>(analyticsGet, {
      method: 'GET',
      url: 'https://example.com/api/admin/analytics?days=not-a-number',
      env: buildEnv({ db }),
    })

    expect(defaulted.status).toBe(200)
    expect(defaulted.body.filters.days).toBe(30)
    expect(defaulted.body.total).toBe(1)
  })
})