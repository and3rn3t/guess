import { describe, expect, it } from 'vitest'
import { createTestDb } from '../api/admin/__tests__/harness'
import {
  CSP_DIGEST_CRON,
  CSP_DIGEST_KEY,
  runCspDigest,
  type CspDigest,
} from './_csp_digest'
import { d1CacheGet } from '../api/_d1_cache'

describe('runCspDigest', () => {
  it('no-ops when the cron expression does not match', async () => {
    const db = createTestDb()
    const result = await runCspDigest(
      { cron: '0 0 * * *' },
      { GUESS_DB: db.d1 as unknown as D1Database },
      () => {},
    )
    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('cron does not match')
  })

  it('no-ops when GUESS_DB is unbound', async () => {
    const result = await runCspDigest({ cron: CSP_DIGEST_CRON }, {}, () => {})
    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('no D1 binding')
  })

  it('aggregates violations and persists the digest snapshot to kv_cache', async () => {
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

    await insert('script-src-elem', 'https://a.example/x.js', 42, now)
    await insert('script-src-elem', 'https://b.example/y.js', 8, now)
    await insert('img-src', 'https://t.example/p.gif', 30, now)
    // Stale row outside the 7-day window — must be excluded.
    await insert('img-src', 'https://stale.example/o.gif', 999, now - 30 * 86_400_000)

    const result = await runCspDigest(
      { cron: CSP_DIGEST_CRON },
      { GUESS_DB: db.d1 as unknown as D1Database },
      () => {},
    )

    expect(result.status).toBe('generated')
    expect(result.totalViolations).toBe(80)
    expect(result.uniquePairs).toBe(3)

    const digest = await d1CacheGet<CspDigest>(
      db.d1 as unknown as D1Database,
      CSP_DIGEST_KEY,
    )
    expect(digest).not.toBeNull()
    expect(digest?.totalViolations).toBe(80)
    expect(digest?.uniquePairs).toBe(3)
    expect(digest?.topViolations[0]).toMatchObject({
      directive: 'script-src-elem',
      blocked_uri: 'https://a.example/x.js',
      count: 42,
    })
    expect(digest?.byDirective).toEqual([
      { directive: 'script-src-elem', count: 50 },
      { directive: 'img-src', count: 30 },
    ])
  })
})
