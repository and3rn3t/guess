import { CURRENT_SCHEMA_VERSION, KV_SCHEMA_VERSION } from './constants'

type MigrationFn = () => Promise<void>

const migrations: Record<string, MigrationFn> = {
  '1to2': migrateV1toV2,
}

export async function runMigrations(): Promise<void> {
  const currentStr = localStorage.getItem(KV_SCHEMA_VERSION)
  const current = currentStr ? Number.parseInt(currentStr, 10) : 1

  if (current >= CURRENT_SCHEMA_VERSION) return

  for (let v = current; v < CURRENT_SCHEMA_VERSION; v++) {
    const key = `${v}to${v + 1}`
    const fn = migrations[key]
    if (fn) {
      console.log(`Running migration ${key}...`)
      await fn()
    }
    localStorage.setItem(KV_SCHEMA_VERSION, String(v + 1))
  }

  console.log(`Migrations complete. Schema version: ${CURRENT_SCHEMA_VERSION}`)
}

/** Migrate a localStorage JSON array to IndexedDB via an insert function */
async function migrateArrayToIdb(
  storageKey: string,
  backupKey: string,
  insertFn: (item: unknown) => Promise<void>,
  label: string
): Promise<void> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    const items = JSON.parse(raw)
    if (!Array.isArray(items)) return

    for (const item of items) {
      try {
        await insertFn(item)
      } catch {
        // Skip duplicate entries (if migration reruns)
      }
    }
    localStorage.setItem(backupKey, raw)
  } catch (e) {
    console.warn(`${label} migration failed:`, e)
  }
}

/** Add isCustom flag to existing characters in localStorage */
function migrateCharacterFlags(): void {
  try {
    const raw = localStorage.getItem('kv:characters')
    if (!raw) return

    const characters = JSON.parse(raw)
    if (!Array.isArray(characters)) return

    for (const char of characters) {
      if (char.isCustom === undefined) {
        char.isCustom = typeof char.id === 'string' && char.id.startsWith('char-')
      }
    }
    localStorage.setItem('kv:characters', JSON.stringify(characters))
  } catch (e) {
    console.warn('Character migration failed:', e)
  }
}

/** v1→v2: Migrate game history from localStorage to IndexedDB + add isCustom flag */
async function migrateV1toV2(): Promise<void> {
  const { addGameEntry } = await import('./db')
  const { addAnalyticsEvent } = await import('./db')

  await migrateArrayToIdb(
    'kv:game-history', 'kv:game-history-backup',
    (entry) => addGameEntry(entry as import('./types').GameHistoryEntry),
    'Game history'
  )

  await migrateArrayToIdb(
    'kv:analytics', 'kv:analytics-backup',
    (event) => addAnalyticsEvent(event as import('./db').AnalyticsEvent),
    'Analytics'
  )

  migrateCharacterFlags()
}
