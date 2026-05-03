import { describe, expect, it } from 'vitest'
import { buildEnv, createTestKv, invokeHandler } from './harness'
import { onRequestGet, onRequestPost } from '../workflow-progress'

interface WorkflowProgressRecord {
  activeTo: string | null
  completed: boolean
}

type WorkflowProgressMap = Record<string, WorkflowProgressRecord>

describe('GET/POST /api/admin/workflow-progress', () => {
  it('returns 503 when KV is unavailable', async () => {
    const res = await invokeHandler(onRequestGet, {
      method: 'GET',
      env: buildEnv(),
    })

    expect(res.status).toBe(503)
  })

  it('round-trips workflow progress through KV', async () => {
    const kv = createTestKv()
    const progress: WorkflowProgressMap = {
      'curate-core': { activeTo: 'questions', completed: false },
      'monitor-loop': { activeTo: 'analytics', completed: true },
    }

    const save = await invokeHandler<{ ok: boolean; progress: WorkflowProgressMap }>(onRequestPost, {
      method: 'POST',
      env: buildEnv({ kv }),
      body: { progress },
    })

    expect(save.status).toBe(200)
    expect(save.body.ok).toBe(true)
    expect(save.body.progress).toEqual(progress)

    const read = await invokeHandler<{ progress: WorkflowProgressMap }>(onRequestGet, {
      method: 'GET',
      env: buildEnv({ kv }),
    })

    expect(read.status).toBe(200)
    expect(read.body.progress).toEqual(progress)
  })

  it('rejects invalid progress payloads', async () => {
    const kv = createTestKv()

    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv({ kv }),
      body: {
        progress: {
          'curate-core': { activeTo: 123, completed: 'nope' },
        },
      },
    })

    expect(res.status).toBe(400)
  })
})
