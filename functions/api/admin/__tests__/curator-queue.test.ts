import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { onRequestGet } from '../curator-queue'
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('/api/admin/curator-queue', () => {
  let mockDb: any
  let mockEnv: any
  let mockContext: any

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    }

    mockEnv = {
      GUESS_DB: mockDb,
    } as any  

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET returns curator queue report', async () => {
    const mockRows = [
      {
        id: 1,
        character_id: 'c1',
        attribute_key: 'personality',
        issue_type: 'cannot_infer',
        issue_reason: 'Test',
        category: 'anime',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: Date.now() - 86400000,
        updated_at: Date.now() - 86400000,
        popularity: 0.8,
        priority_score: 0.5,
      },
    ]

    const mockStatement = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: mockRows }),
    }

    mockDb.prepare.mockReturnValue(mockStatement)

    mockContext = {
      env: mockEnv,
      request: new Request('http://localhost/api/admin/curator-queue', {
        method: 'GET',
      }),
    }

    const response = await onRequestGet(mockContext as any)  
    expect(response.status).toBe(200)
  })

  it('GET returns 503 if DB is unavailable', async () => {
    mockEnv.GUESS_DB = null as any  

    mockContext = {
      env: mockEnv,
      request: new Request('http://localhost/api/admin/curator-queue', {
        method: 'GET',
      }),
    }

    const response = await onRequestGet(mockContext as any)  
    expect(response.status).toBe(503)
  })
})
