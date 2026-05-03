import { describe, expect, it } from 'vitest'
import { buildEnv, createTestKv, invokeHandler } from './harness'
import { onRequestGet } from '../source-health-status'
import { SOURCE_HEALTH_REPORT_KEY } from '../../_source_health'

describe('GET /api/admin/source-health-status', () => {
  it('returns 503 when KV is unavailable', async () => {
    const res = await invokeHandler(onRequestGet, {
      method: 'GET',
      env: buildEnv(),
    })

    expect(res.status).toBe(503)
  })

  it('returns null report when KV has no source-health payload', async () => {
    const kv = createTestKv()

    const res = await invokeHandler<{ report: unknown | null; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toBeNull()
    expect(typeof res.body.fetchedAt).toBe('number')
  })

  it('returns stored source-health report from KV', async () => {
    const kv = createTestKv()
    const seeded = {
      generatedAt: '2026-05-03T20:15:00.000Z',
      totals: {
        totalCharacters: 100,
        validCharacters: 90,
        issueCount: 10,
        coveragePct: 0.9,
      },
      perSource: [
        {
          source: 'tmdb',
          total: 20,
          valid: 19,
          missing: 1,
          malformed: 0,
          coveragePct: 0.95,
        },
      ],
      issues: [],
    }
    await kv.put(SOURCE_HEALTH_REPORT_KEY, JSON.stringify(seeded))

    const res = await invokeHandler<{ report: typeof seeded; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toEqual(seeded)
  })
})
