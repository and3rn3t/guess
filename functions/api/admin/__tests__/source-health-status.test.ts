import { describe, expect, it } from 'vitest'
import { buildEnv, createTestDb, invokeHandler } from './harness'
import { onRequestGet } from '../source-health-status'

describe('GET /api/admin/source-health-status', () => {
  it('returns null report when no source-health payload is stored', async () => {
    const db = createTestDb()
    const res = await invokeHandler<{ report: unknown | null; fetchedAt: number }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ db }),
    })

    expect(res.status).toBe(200)
    expect(res.body.report).toBeNull()
    expect(typeof res.body.fetchedAt).toBe('number')
  })
})
