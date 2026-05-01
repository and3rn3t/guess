/**
 * AP.2 — round-trip test harness for admin Pages Functions.
 *
 * Provides:
 *   - createTestDb(): an in-memory better-sqlite3 instance loaded with every
 *     migration in `migrations/000*.sql`, exposed through a thin facade that
 *     mimics the Cloudflare D1Database API the handlers consume.
 *   - createTestKv(): a Map-backed KVNamespace stub with the subset of the API
 *     the admin handlers use (get/put/delete/list).
 *   - invokeHandler(): builds a synthetic PagesFunction context (env, request,
 *     params, waitUntil) and calls the handler, returning the Response plus the
 *     parsed JSON body for assertions.
 *
 * Intentionally pragmatic — this is *not* a full D1 polyfill. It implements
 * exactly what the admin handlers exercise (prepare/bind/run/all/first, batch,
 * exec). Parameters are coerced from JS booleans to 0/1 the way D1 does on
 * the edge.
 */
import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ───────────────────────────────────────────────────────────────────────────────
// Schema loading
// ───────────────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations')

let _schemaSql: string | null = null

/**
 * Concatenate every numbered migration in `migrations/` once per process.
 * Skips heavy seed migrations (0002 character seed, 0005 ingest, 0009 default
 * attrs) so tests start from an empty catalog and explicitly seed only what
 * each handler needs. Schema-only DDL still runs in the same order as prod.
 */
const SKIP_MIGRATIONS = new Set([
  '0002_seed.sql',
  '0004_backfill_new_attrs.sql',
  '0005_ingest_characters.sql',
  '0009_seed_default_attrs.sql',
])

function loadAllMigrations(): string {
  if (_schemaSql) return _schemaSql
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}[a-z]?_.*\.sql$/.test(f))
    .filter((f) => !SKIP_MIGRATIONS.has(f))
    .sort((a, b) => a.localeCompare(b))
  _schemaSql = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
  return _schemaSql
}

// ───────────────────────────────────────────────────────────────────────────────
// D1 facade over better-sqlite3
// ───────────────────────────────────────────────────────────────────────────────

type Param = string | number | bigint | Uint8Array | null

function coerce(v: unknown): Param {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === null) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') return v
  if (v instanceof Uint8Array) return v
  // Objects (e.g. ArrayBuffer) fall back to JSON — never expected in practice.
  return JSON.stringify(v)
}

class StatementWrapper {
  private bound: Param[] = []
  constructor(
    private readonly db: Database.Database,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): StatementWrapper {
    const next = new StatementWrapper(this.db, this.sql)
    next.bound = values.map(coerce)
    return next
  }

  /** Test-only: synchronous run for use inside `db.transaction()` callbacks. */
  runSync(): {
    success: boolean
    meta: {
      changes: number
      last_row_id: number
      duration: number
      rows_read: number
      rows_written: number
    }
  } {
    const stmt = this.db.prepare(this.sql)
    const info = this.bound.length > 0 ? stmt.run(...this.bound) : stmt.run()
    return {
      success: true,
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
        duration: 0,
        rows_read: 0,
        rows_written: info.changes,
      },
    }
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql)
    const row = (this.bound.length > 0 ? stmt.get(...this.bound) : stmt.get()) as
      | Record<string, unknown>
      | undefined
    if (!row) return null
    if (colName) return (row[colName] ?? null) as T
    return row as T
  }

  async run<T = unknown>(): Promise<{
    success: boolean
    meta: {
      changes: number
      last_row_id: number
      duration: number
      rows_read: number
      rows_written: number
    }
    results?: T[]
  }> {
    return this.runSync()
  }

  async all<T = unknown>(): Promise<{
    success: boolean
    meta: { duration: number; rows_read: number; rows_written: number }
    results: T[]
  }> {
    const stmt = this.db.prepare(this.sql)
    const rows = (this.bound.length > 0 ? stmt.all(...this.bound) : stmt.all()) as T[]
    return {
      success: true,
      meta: { duration: 0, rows_read: rows.length, rows_written: 0 },
      results: rows,
    }
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const stmt = this.db.prepare(this.sql).raw()
    const rows = (this.bound.length > 0 ? stmt.all(...this.bound) : stmt.all()) as T[]
    return rows
  }
}

class D1Facade {
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.db, sql)
  }

  async batch(
    statements: StatementWrapper[],
  ): Promise<Array<ReturnType<StatementWrapper['runSync']>>> {
    const results: Array<ReturnType<StatementWrapper['runSync']>> = []
    // D1 batch is transactional — wrap in better-sqlite3 transaction. Must be
    // synchronous (better-sqlite3 rejects async transaction callbacks).
    const trx = this.db.transaction(() => {
      for (const s of statements) {
        results.push(s.runSync())
      }
    })
    trx()
    return results
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.db.exec(sql)
    return { count: 0, duration: 0 }
  }

  /** Test-only escape hatch for direct SQL execution in seed helpers. */
  raw(): Database.Database {
    return this.db
  }
}

export interface TestDb {
  d1: D1Facade
  raw: Database.Database
  close: () => void
}

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  // Disable FK checks during schema load — some migrations backfill data into
  // tables before their referenced rows exist (those rows are seeded by
  // 0002/0005/0009 which we skip). Re-enabled after schema load so handler
  // round-trips still see referential integrity.
  sqlite.pragma('foreign_keys = OFF')
  sqlite.exec(loadAllMigrations())
  sqlite.pragma('foreign_keys = ON')
  return {
    d1: new D1Facade(sqlite),
    raw: sqlite,
    close: () => sqlite.close(),
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// KV stub
// ───────────────────────────────────────────────────────────────────────────────

interface KvEntry {
  value: string
  expiration?: number
}

export interface TestKv {
  get(
    key: string,
    type?: 'text' | 'json' | { type: 'text' } | { type: 'json' },
  ): Promise<unknown>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list<T = unknown>(options?: {
    prefix?: string
  }): Promise<{ keys: Array<{ name: string; metadata?: T }>; list_complete: boolean }>
  /** Test-only: access the backing store. */
  _store: Map<string, KvEntry>
}

export function createTestKv(initial?: Record<string, string>): TestKv {
  const store = new Map<string, KvEntry>()
  if (initial) {
    for (const [k, v] of Object.entries(initial)) store.set(k, { value: v })
  }

  const kv: TestKv = {
    _store: store,
    async get(key, type) {
      const entry = store.get(key)
      if (!entry) return null
      const wantsJson =
        type === 'json' || (typeof type === 'object' && type !== null && type.type === 'json')
      if (wantsJson) {
        try {
          return JSON.parse(entry.value)
        } catch {
          return null
        }
      }
      return entry.value
    },
    async put(key, value, _options) {
      store.set(key, { value })
    },
    async delete(key) {
      store.delete(key)
    },
    async list(options) {
      const prefix = options?.prefix ?? ''
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }))
      return { keys, list_complete: true }
    },
  }
  return kv
}

// ───────────────────────────────────────────────────────────────────────────────
// R2 stub (only used by resolve-stack)
// ───────────────────────────────────────────────────────────────────────────────

export interface TestR2 {
  put(key: string, value: string | ArrayBuffer | Uint8Array): Promise<void>
  get(key: string): Promise<{
    json: () => Promise<unknown>
    text: () => Promise<string>
    arrayBuffer: () => Promise<ArrayBuffer>
  } | null>
  delete(key: string): Promise<void>
}

export function createTestR2(): TestR2 {
  const store = new Map<string, string>()
  return {
    async put(key, value) {
      let serialized: string
      if (typeof value === 'string') {
        serialized = value
      } else {
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
        serialized = new TextDecoder().decode(bytes)
      }
      store.set(key, serialized)
    },
    async get(key) {
      const v = store.get(key)
      if (v === undefined) return null
      return {
        json: async () => JSON.parse(v),
        text: async () => v,
        arrayBuffer: async () => {
          const buf = new TextEncoder().encode(v).buffer
          return buf instanceof ArrayBuffer ? buf : new ArrayBuffer(0)
        },
      }
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Handler invocation
// ───────────────────────────────────────────────────────────────────────────────

export interface BuildEnvOptions {
  db?: TestDb
  kv?: TestKv
  /** Same KV instance used for `GUESS_ASSETS` — many handlers cache here. */
  assets?: TestKv
  r2?: TestR2
  openaiKey?: string
}

export function buildEnv(opts: BuildEnvOptions = {}): Record<string, unknown> {
  return {
    GUESS_DB: opts.db?.d1,
    GUESS_KV: opts.kv,
    GUESS_ASSETS: opts.assets ?? opts.kv,
    GUESS_IMAGES: opts.r2,
    OPENAI_API_KEY: opts.openaiKey ?? '',
  }
}

export interface InvokeOptions {
  method?: string
  url?: string
  body?: unknown
  params?: Record<string, string>
  env: Record<string, unknown>
}

export interface InvokeResult<T = unknown> {
  status: number
  body: T
  response: Response
}

/**
 * Build a synthetic PagesFunction context and call the handler. Mirrors the
 * Cloudflare runtime surface the admin handlers consume — env, request,
 * params, waitUntil — and decodes the JSON response for ergonomic asserts.
 */
// Type-erase the handler — admin handlers use multiple Env shapes via separate
// imports, all assignable to the test env we build with `buildEnv`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPagesFunction = (context: any) => Promise<Response> | Response

export async function invokeHandler<T = unknown>(
  handler: AnyPagesFunction,
  opts: InvokeOptions,
): Promise<InvokeResult<T>> {
  const method = opts.method ?? 'POST'
  const url = opts.url ?? 'https://example.com/api/admin/test'
  const init: RequestInit = { method }
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  const request = new Request(url, init)
  const response = await handler({
    env: opts.env,
    request,
    params: opts.params ?? {},
    waitUntil: () => {},
    next: async () => new Response(null, { status: 404 }),
    data: {},
  })
  let body: unknown = null
  const text = await response.clone().text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: response.status, body: body as T, response }
}

// ───────────────────────────────────────────────────────────────────────────────
// fetch mocking — for handlers that call OpenAI directly
// ───────────────────────────────────────────────────────────────────────────────

export interface MockFetchOptions {
  /** JSON content returned in `choices[0].message.content`. */
  content?: string
  /** Override for non-200 responses. */
  status?: number
  /** Raw response body — overrides `content`. */
  body?: string
}

/**
 * Replace `globalThis.fetch` with a stub that returns a canned OpenAI Chat
 * Completions response. Returns a `restore()` function plus the call log.
 */
export function mockOpenAi(opts: MockFetchOptions = {}): {
  restore: () => void
  calls: Array<{ url: string; init: RequestInit | undefined }>
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const original = globalThis.fetch
  const status = opts.status ?? 200
  const body =
    opts.body ??
    JSON.stringify({
      choices: [{ message: { content: opts.content ?? '{}' } }],
    })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string
    if (typeof input === 'string') url = input
    else if (input instanceof URL) url = input.toString()
    else url = input.url
    calls.push({ url, init })
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return {
    restore: () => {
      globalThis.fetch = original
    },
    calls,
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Seed helpers
// ───────────────────────────────────────────────────────────────────────────────

export function seedCharacter(
  db: TestDb,
  id: string,
  overrides: Partial<{ name: string; category: string }> = {},
): void {
  db.raw
    .prepare(
      `INSERT OR IGNORE INTO characters (id, name, category, source) VALUES (?, ?, ?, 'default')`,
    )
    .run(id, overrides.name ?? id, overrides.category ?? 'video-games')
}

export function seedAttributeDefinition(
  db: TestDb,
  key: string,
  overrides: Partial<{ display_text: string; question_text: string; is_active: number }> = {},
): void {
  db.raw
    .prepare(
      `INSERT OR IGNORE INTO attribute_definitions (key, display_text, question_text, is_active)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      key,
      overrides.display_text ?? key,
      overrides.question_text ?? `Is the character ${key}?`,
      overrides.is_active ?? 1,
    )
}
