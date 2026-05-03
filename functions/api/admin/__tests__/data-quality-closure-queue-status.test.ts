import { describe, expect, it } from 'vitest'
import { buildEnv, createTestKv, invokeHandler } from './harness'
import { onRequestGet } from '../data-quality/closure-queue-status'
import { CLOSURE_QUEUE_REPORT_KEY } from '../data-quality/_closure_queue'

describe('GET /api/admin/data-quality/closure-queue-status', () => {
  it('returns 503 when KV is unavailable', async () => {
    const res = await invokeHandler(onRequestGet, {
      method: 'GET',
      env: buildEnv(),
    })

    expect(res.status).toBe(503)
  })

  it('returns null report when KV has no closure queue payload', async () => {
    const kv = createTestKv()

    const res = await invokeHandler<{ report: unknown | null; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toBeNull()
    expect(typeof res.body.fetchedAt).toBe('number')
  })

  it('returns stored closure queue report from KV', async () => {
    const kv = createTestKv()
    const seeded = {
      generatedAt: '2026-05-03T20:15:00.000Z',
      limit: 200,
      lanePolicy: {
        automationScoreThreshold: 0.00002,
        automationMinConfidenceGap: 0.1,
      },
      totalCandidatePairs: 1200,
      summary: {
        totalPairs: 200,
        automationPairs: 120,
        manualPairs: 80,
        categories: { anime: 200 },
        attributes: { isHuman: 200 },
      },
      queue: [],
    }
    await kv.put(CLOSURE_QUEUE_REPORT_KEY, JSON.stringify(seeded))

    const res = await invokeHandler<{ report: typeof seeded; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toEqual(seeded)
  })
})
