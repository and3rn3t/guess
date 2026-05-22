import { describe, expect, it, beforeEach } from 'vitest'
import { buildEnv, createTestDb, invokeHandler, type TestDb } from './harness'
import { onRequestPost } from '../workflow-progress'

interface WorkflowProgressRecord {
  activeTo: string | null
  completed: boolean
}

type WorkflowProgressMap = Record<string, WorkflowProgressRecord>

describe('GET/POST /api/admin/workflow-progress', () => {
  let db: TestDb
  beforeEach(() => { db = createTestDb() })

  it('round-trips workflow progress through D1', async () => {
    const progress: WorkflowProgressMap = {
      'curate-core': { activeTo: 'questions', completed: false },
      'monitor-loop': { activeTo: 'analytics', completed: true },
    }

    const save = await invokeHandler<{ ok: boolean; progress: WorkflowProgressMap }>(onRequestPost, {
      method: 'POST',
      env: buildEnv({ db }),
      body: { progress },
    })

    expect(save.status).toBe(200)
    expect(save.body.ok).toBe(true)
    expect(save.body.progress).toEqual(progress)
  })

  it('rejects invalid progress payloads', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv({ db }),
      body: {
        progress: {
          'curate-core': { activeTo: 123, completed: 'nope' },
        },
      },
    })

    expect(res.status).toBe(400)
  })
})
