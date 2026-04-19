import { describe, it, expect, vi, beforeEach } from 'vitest'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
})

describe('runMigrations', () => {
  it('sets schema version to current after migration', async () => {
    // Start at version 1 (no version key = v1)
    const { runMigrations } = await import('./migrations')
    // Mock the dynamic imports that migrateV1toV2 uses
    vi.doMock('./db', () => ({
      addGameEntry: vi.fn().mockResolvedValue(undefined),
      addAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
    }))

    await runMigrations()

    const { CURRENT_SCHEMA_VERSION } = await import('./constants')
    expect(store['kv:schema-version']).toBe(String(CURRENT_SCHEMA_VERSION))
  })

  it('is a no-op when already at current version', async () => {
    const { CURRENT_SCHEMA_VERSION } = await import('./constants')
    store['kv:schema-version'] = String(CURRENT_SCHEMA_VERSION)

    const { runMigrations } = await import('./migrations')
    await runMigrations()

    // Should not change
    expect(store['kv:schema-version']).toBe(String(CURRENT_SCHEMA_VERSION))
  })

  it('handles missing localStorage version (defaults to v1)', async () => {
    vi.doMock('./db', () => ({
      addGameEntry: vi.fn().mockResolvedValue(undefined),
      addAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
    }))

    const { runMigrations } = await import('./migrations')
    await runMigrations()

    expect(store['kv:schema-version']).toBeDefined()
  })
})
