// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})
vi.stubGlobal('crypto', { randomUUID: () => 'test-user-id-abc' })
vi.stubGlobal('navigator', { onLine: true })

beforeEach(() => {
  vi.resetModules()
  for (const key of Object.keys(store)) delete store[key]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getUserId', () => {
  it('generates and persists a user ID', async () => {
    const { getUserId } = await import('./utils')
    const id = getUserId()
    expect(id).toBe('test-user-id-abc')
    expect(store['kv:user-id']).toBe('test-user-id-abc')
  })

  it('returns existing user ID from localStorage', async () => {
    store['kv:user-id'] = 'existing-id-456'
    const { getUserId } = await import('./utils')
    const id = getUserId()
    expect(id).toBe('existing-id-456')
  })
})

describe('fetchGlobalCharacters', () => {
  it('fetches characters from API', async () => {
    server.use(
      http.get('/api/v2/characters', () =>
        HttpResponse.json({
          characters: [
            {
              id: 'mario',
              name: 'Mario',
              category: 'video-games',
              attributes_json: '{"isHuman":1}',
            },
          ],
        })),
    )

    const { fetchGlobalCharacters } = await import('./sync')
    const chars = await fetchGlobalCharacters()
    expect(chars).toHaveLength(1)
    expect(chars[0].id).toBe('mario')
  })

  it('returns cached characters within TTL', async () => {
    store['kv:characters-cache'] = JSON.stringify([{ id: 'cached', name: 'Cached' }])
    store['kv:characters-cache:ts'] = String(Date.now())
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const { fetchGlobalCharacters } = await import('./sync')
    const chars = await fetchGlobalCharacters()
    expect(chars[0].id).toBe('cached')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('ignores stale cache and fetches fresh data', async () => {
    store['kv:characters-cache'] = JSON.stringify([{ id: 'stale', name: 'Stale' }])
    store['kv:characters-cache:ts'] = String(Date.now() - 11 * 60 * 1000) // 11 min old

    server.use(
      http.get('/api/v2/characters', () =>
        HttpResponse.json({
          characters: [
            {
              id: 'mario',
              name: 'Mario',
              category: 'video-games',
              attributes_json: '{}',
            },
          ],
        })),
    )

    const { fetchGlobalCharacters } = await import('./sync')
    const chars = await fetchGlobalCharacters()
    expect(chars[0].id).toBe('mario')
  })

  it('falls back to stale cache on network error', async () => {
    store['kv:characters-cache'] = JSON.stringify([{ id: 'stale', name: 'Stale' }])
    store['kv:characters-cache:ts'] = String(Date.now() - 20 * 60 * 1000)

    server.use(
      http.get('/api/v2/characters', () => HttpResponse.error()),
    )

    const { fetchGlobalCharacters } = await import('./sync')
    const chars = await fetchGlobalCharacters()
    expect(chars[0].id).toBe('stale')
  })

  it('returns empty array when no cache and network error', async () => {
    server.use(
      http.get('/api/v2/characters', () => HttpResponse.error()),
    )

    const { fetchGlobalCharacters } = await import('./sync')
    const chars = await fetchGlobalCharacters()
    expect(chars).toEqual([])
  })
})

describe('fetchGlobalQuestions', () => {
  it('fetches questions from API', async () => {
    server.use(
      http.get('/api/v2/questions', () =>
        HttpResponse.json([{ id: 'q1', text: 'Is this character human?', attribute: 'isHuman' }])),
    )

    const { fetchGlobalQuestions } = await import('./sync')
    const qs = await fetchGlobalQuestions()
    expect(qs).toHaveLength(1)
    expect(qs[0].attribute).toBe('isHuman')
  })
})

describe('submitCharacter', () => {
  it('submits character and invalidates cache', async () => {
    store['kv:characters-cache:ts'] = String(Date.now())

    server.use(
      http.post('/api/v2/characters', () => HttpResponse.json({ success: true })),
    )

    const { submitCharacter } = await import('./sync')
    const result = await submitCharacter({
      name: 'Test',
      category: 'movies',
      attributes: { isHuman: true },
    })

    expect(result.success).toBe(true)
    expect(store['kv:characters-cache:ts']).toBeUndefined()
  })

  it('returns error on failed submission', async () => {
    server.use(
      http.post('/api/v2/characters', () =>
        HttpResponse.json({ error: 'Duplicate' }, { status: 409 })),
    )

    const { submitCharacter } = await import('./sync')
    const result = await submitCharacter({
      name: 'Test',
      category: 'movies',
      attributes: {},
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Duplicate')
  })

  it('handles network errors gracefully', async () => {
    server.use(
      http.post('/api/v2/characters', () => HttpResponse.error()),
    )

    const { submitCharacter } = await import('./sync')
    const result = await submitCharacter({
      name: 'Test',
      category: 'movies',
      attributes: {},
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network')
  })

  it('also submits associated questions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    server.use(
      http.post('/api/v2/characters', () => HttpResponse.json({ success: true })),
      http.post('/api/questions', () => HttpResponse.json({ success: true })),
    )

    const { submitCharacter } = await import('./sync')
    await submitCharacter(
      { name: 'Test', category: 'movies', attributes: {} },
      [{ text: 'Is human?', attribute: 'isHuman' }],
    )

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('recordGameResult', () => {
  it('sends stats without throwing', async () => {
    server.use(
      http.post('/api/stats', () => HttpResponse.json({ success: true })),
    )

    const { recordGameResult } = await import('./sync')
    await expect(recordGameResult('mario', true, 5, 'medium')).resolves.not.toThrow()
  })

  it('silently handles network errors', async () => {
    server.use(
      http.post('/api/stats', () => HttpResponse.error()),
    )

    const { recordGameResult } = await import('./sync')
    await expect(recordGameResult('mario', true, 5, 'medium')).resolves.not.toThrow()
  })
})

describe('submitCorrection', () => {
  it('submits correction and returns result', async () => {
    server.use(
      http.post('/api/corrections', () =>
        HttpResponse.json({ success: true, autoApplied: false })),
    )

    const { submitCorrection } = await import('./sync')
    const result = await submitCorrection('mario', 'isHuman', true, false)
    expect(result.success).toBe(true)
  })

  it('returns error object when server responds with non-ok status', async () => {
    server.use(
      http.post('/api/corrections', () =>
        HttpResponse.json({ error: 'Attribute not found' }, { status: 422 })),
    )

    const { submitCorrection } = await import('./sync')
    const result = await submitCorrection('mario', 'isHuman', true, false)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Attribute not found')
  })

  it('returns network error when fetch throws', async () => {
    server.use(
      http.post('/api/corrections', () => HttpResponse.error()),
    )

    const { submitCorrection } = await import('./sync')
    const result = await submitCorrection('mario', 'isHuman', true, false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('syncStatus', () => {
  it('starts as synced', async () => {
    const { getSyncStatus } = await import('./sync')
    expect(getSyncStatus()).toBe('synced')
  })

  it('notifies listeners on status change', async () => {
    server.use(
      http.get('/api/v2/characters', () => HttpResponse.json({ characters: [] })),
      http.get('/api/v2/questions', () => HttpResponse.json([])),
    )

    const { onSyncStatusChange, initialSync } = await import('./sync')
    const statuses: string[] = []
    const unsub = onSyncStatusChange((s) => statuses.push(s))

    await initialSync()
    unsub()

    expect(statuses).toContain('pending')
    expect(statuses).toContain('synced')
  })

  it('unsubscribe removes listener so it is no longer called', async () => {
    server.use(
      http.get('/api/v2/characters', () => HttpResponse.json({ characters: [] })),
      http.get('/api/v2/questions', () => HttpResponse.json([])),
    )

    const { onSyncStatusChange, initialSync } = await import('./sync')
    const statuses: string[] = []
    const unsub = onSyncStatusChange((s) => statuses.push(s))

    // Unsubscribe before any changes
    unsub()
    await initialSync()

    expect(statuses).toHaveLength(0)
  })

  it('goes pending then synced even when fetch fails (internal fallback)', async () => {
    // fetchGlobalCharacters / fetchGlobalQuestions swallow their own errors and
    // return [] — so initialSync never throws and always emits 'synced'.
    server.use(
      http.get('/api/v2/characters', () => HttpResponse.error()),
      http.get('/api/v2/questions', () => HttpResponse.error()),
    )

    const { onSyncStatusChange, initialSync } = await import('./sync')
    const statuses: string[] = []
    const unsub = onSyncStatusChange((s) => statuses.push(s))
    await initialSync()
    unsub()

    expect(statuses).toContain('pending')
    expect(statuses).toContain('synced')
  })
})
