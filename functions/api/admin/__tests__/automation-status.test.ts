import { describe, expect, it } from 'vitest'
import { buildEnv, createTestDb, invokeHandler } from './harness'
import { onRequestGet } from '../automation-status'

describe('GET /api/admin/automation-status', () => {
  it('returns null report when no automation payload is stored yet', async () => {
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
