import { describe, expect, it } from 'vitest'
import { buildEnv, createTestKv, invokeHandler } from './harness'
import { onRequestGet } from '../automation-status'

describe('GET /api/admin/automation-status', () => {
  it('returns 503 when KV is unavailable', async () => {
    const res = await invokeHandler(onRequestGet, {
      method: 'GET',
      env: buildEnv(),
    })

    expect(res.status).toBe(503)
  })

  it('returns null report when no automation payload is stored yet', async () => {
    const kv = createTestKv()

    const res = await invokeHandler<{ report: unknown | null; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toBeNull()
    expect(typeof res.body.fetchedAt).toBe('number')
  })

  it('returns the stored automation payload when present', async () => {
    const kv = createTestKv()
    const seeded = {
      cron: '5 0 * * *',
      ranAt: Date.now(),
      durationMs: 121,
      errorCount: 1,
      snapshot: 'inserted',
      duplicatesEmbedded: 3,
      enrichmentKick: 'started',
      retiredQuestions: 0,
      stepDurationsMs: {
        snapshot: 10,
        duplicates: 50,
        enrichment: 45,
        retirement: 16,
      },
      stepErrors: {
        snapshot: null,
        duplicates: 'sample error',
        enrichment: null,
        retirement: null,
      },
      notes: ['sample'],
    }
    await kv.put('admin:automation:last-run', JSON.stringify(seeded))

    const res = await invokeHandler<{ report: typeof seeded; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toEqual(seeded)
  })
})
