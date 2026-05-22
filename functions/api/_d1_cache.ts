/// <reference types="@cloudflare/workers-types" />
/**
 * D1-backed cache utilities — replaces all GUESS_KV / GUESS_ASSETS usage.
 *
 * Mirrors the KV TTL pattern using an `expires_at` column:
 *   - d1CacheGet  — returns null when the row is missing or expired (lazy-deletes stale rows)
 *   - d1CachePut  — upserts with optional TTL in seconds
 *   - d1CacheDelete — removes a key
 *
 * The `kv_cache` table is created by migration 0047_kv_migration.sql.
 */

interface CacheRow {
  value: string
  expires_at: number | null
}

/** Read a cached value. Returns null if missing or expired (and lazily deletes expired rows). */
export async function d1CacheGet<T>(db: D1Database, key: string): Promise<T | null> {
  const now = Math.floor(Date.now() / 1000)
  const row = await db
    .prepare('SELECT value, expires_at FROM kv_cache WHERE key = ?')
    .bind(key)
    .first<CacheRow>()

  if (!row) return null

  if (row.expires_at !== null && row.expires_at < now) {
    // Lazy expiry — fire-and-forget delete
    db.prepare('DELETE FROM kv_cache WHERE key = ?').bind(key).run().catch(() => {})
    return null
  }

  try {
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

/**
 * Write a value to the cache.
 * @param ttlSeconds — seconds until expiry; omit or pass 0 for no expiry
 */
export async function d1CachePut(
  db: D1Database,
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = ttlSeconds && ttlSeconds > 0 ? now + ttlSeconds : null
  await db
    .prepare(
      'INSERT OR REPLACE INTO kv_cache (key, value, cached_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(key, JSON.stringify(value), now, expiresAt)
    .run()
}

/** Delete a cached value. No-op if key doesn't exist. */
export async function d1CacheDelete(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM kv_cache WHERE key = ?').bind(key).run()
}

/**
 * Read a plain string value from engine_config (not JSON-encoded).
 * Used for simple scalar flags like 'true' / 'false' / numeric strings.
 */
export async function d1ConfigGet(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM engine_config WHERE key = ?')
    .bind(key)
    .first<{ value: string }>()
  return row?.value ?? null
}

/**
 * Read a JSON value from engine_config.
 * Returns null if missing or unparseable.
 */
export async function d1ConfigGetJson<T>(db: D1Database, key: string): Promise<T | null> {
  const raw = await d1ConfigGet(db, key)
  if (!raw || raw === 'null') return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Write a value to engine_config (stored as-is; caller serializes JSON if needed). */
export async function d1ConfigSet(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      'INSERT OR REPLACE INTO engine_config (key, value, updated_at) VALUES (?, ?, unixepoch())',
    )
    .bind(key, value)
    .run()
}

/**
 * Read multiple engine_config keys in a single query.
 * Returns a Map<key, value> for only the keys that exist.
 */
export async function d1ConfigGetMulti(
  db: D1Database,
  keys: string[],
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map()
  const placeholders = keys.map(() => '?').join(', ')
  const rows = await db
    .prepare(`SELECT key, value FROM engine_config WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<{ key: string; value: string }>()
  const map = new Map<string, string>()
  for (const row of rows.results) {
    map.set(row.key, row.value)
  }
  return map
}
