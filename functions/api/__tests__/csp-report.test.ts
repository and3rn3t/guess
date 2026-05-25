import { describe, expect, it } from 'vitest'
import { buildEnv, createTestDb, invokeHandler } from '../admin/__tests__/harness'
import { onRequestPost } from '../csp-report'

interface CspRow {
  id: number
  directive: string
  blocked_uri: string
  document_uri: string | null
  user_agent: string | null
  count: number
  first_seen: number
  last_seen: number
}

function makeReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    'csp-report': {
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'https://evil.example.com/x.js',
      'document-uri': 'https://andernator.app/play',
      ...overrides,
    },
  })
}

// Block the runtime waitUntil promise so the test can observe the upsert.
async function callAndWait(body: string, env: Record<string, unknown>): Promise<Response> {
  let waitUntilPromise: Promise<unknown> = Promise.resolve()
  const request = new Request('https://example.com/api/csp-report', {
    method: 'POST',
    headers: { 'User-Agent': 'TestAgent/1.0' },
    body,
  })
  const response = await onRequestPost({
    env: env as never,
    request,
    params: {},
    waitUntil: (p: Promise<unknown>) => {
      waitUntilPromise = p
    },
    next: async () => new Response(null, { status: 404 }),
    data: {},
  } as unknown as Parameters<typeof onRequestPost>[0])
  await waitUntilPromise
  return response
}

describe('POST /api/csp-report', () => {
  it('upserts a new csp_violations row on first report', async () => {
    const db = createTestDb()
    const env = buildEnv({ db })

    const res = await callAndWait(makeReport(), env)
    expect(res.status).toBe(204)

    const rows = (await db.d1
      .prepare('SELECT * FROM csp_violations')
      .all<CspRow>()).results
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      directive: 'script-src-elem',
      blocked_uri: 'https://evil.example.com/x.js',
      document_uri: 'https://andernator.app/play',
      user_agent: 'TestAgent/1.0',
      count: 1,
    })
    expect(rows[0].first_seen).toBeGreaterThan(0)
    expect(rows[0].last_seen).toBeGreaterThan(0)
  })

  it('increments count and updates last_seen on duplicate report', async () => {
    const db = createTestDb()
    const env = buildEnv({ db })

    await callAndWait(makeReport(), env)
    // Small sleep so last_seen can advance by at least 1 ms.
    await new Promise((r) => setTimeout(r, 5))
    await callAndWait(makeReport(), env)
    await callAndWait(makeReport(), env)

    const rows = (await db.d1
      .prepare('SELECT * FROM csp_violations')
      .all<CspRow>()).results
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(3)
    expect(rows[0].last_seen).toBeGreaterThanOrEqual(rows[0].first_seen)
  })

  it('treats different blocked_uri values as separate rows', async () => {
    const db = createTestDb()
    const env = buildEnv({ db })

    await callAndWait(makeReport({ 'blocked-uri': 'https://a.example/x.js' }), env)
    await callAndWait(makeReport({ 'blocked-uri': 'https://b.example/y.js' }), env)

    const rows = (await db.d1
      .prepare('SELECT blocked_uri, count FROM csp_violations ORDER BY blocked_uri')
      .all<{ blocked_uri: string; count: number }>()).results
    expect(rows.map((r) => r.blocked_uri)).toEqual([
      'https://a.example/x.js',
      'https://b.example/y.js',
    ])
    expect(rows.every((r) => r.count === 1)).toBe(true)
  })

  it('strips the source filter token from effective-directive', async () => {
    const db = createTestDb()
    const env = buildEnv({ db })

    await callAndWait(
      JSON.stringify({
        'csp-report': {
          'effective-directive': "script-src 'self' https://cdn.example.com",
          'blocked-uri': 'https://evil.example/z.js',
        },
      }),
      env,
    )

    const row = await db.d1
      .prepare('SELECT directive FROM csp_violations')
      .first<{ directive: string }>()
    expect(row?.directive).toBe('script-src')
  })

  it('rejects bodies larger than 5 KB', async () => {
    const env = buildEnv({ db: createTestDb() })
    const huge = JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(6_000) } })
    const res = await callAndWait(huge, env)
    expect(res.status).toBe(413)
  })

  it('rejects malformed JSON with 400', async () => {
    const env = buildEnv({ db: createTestDb() })
    const res = await callAndWait('{not json', env)
    expect(res.status).toBe(400)
  })

  it('still returns 204 when GUESS_DB is absent (best-effort logging)', async () => {
    const res = await callAndWait(makeReport(), { GUESS_DB: undefined })
    expect(res.status).toBe(204)
  })
})

describe('GET /api/admin/security/csp-violations', () => {
  it('returns dedup\'d violations sorted by count desc with directive buckets', async () => {
    const db = createTestDb()
    const now = Date.now()
    const insert = (directive: string, uri: string, count: number, lastSeen: number) =>
      db.d1
        .prepare(
          `INSERT INTO csp_violations (directive, blocked_uri, count, first_seen, last_seen)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(directive, uri, count, lastSeen - 1, lastSeen)
        .run()

    await insert('script-src-elem', 'https://evil.example/a.js', 42, now)
    await insert('script-src-elem', 'https://evil.example/b.js', 7, now)
    await insert('img-src', 'https://tracker.example/p.gif', 19, now)
    // Out of window — should not appear.
    await insert('img-src', 'https://stale.example/old.gif', 100, now - 30 * 86_400_000)

    const { onRequestGet } = await import('../admin/security/csp-violations')
    const res = await invokeHandler<{
      violations: Array<{ directive: string; count: number }>
      total: number
      directives: Array<{ directive: string; count: number }>
    }>(onRequestGet, {
      method: 'GET',
      url: 'https://example.com/api/admin/security/csp-violations?windowDays=7',
      env: buildEnv({ db }),
    })

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.violations.map((v) => v.count)).toEqual([42, 19, 7])
    expect(res.body.directives).toEqual([
      { directive: 'script-src-elem', count: 49 },
      { directive: 'img-src', count: 19 },
    ])
  })
})
