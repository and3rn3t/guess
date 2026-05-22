import { describe, expect, it } from 'vitest'
import { buildEnv, createTestDb, invokeHandler } from './harness'
import { onRequestGet } from '../data-quality/closure-queue-status'

describe('GET /api/admin/data-quality/closure-queue-status', () => {
  it('returns null report when no closure queue payload is stored', async () => {
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
