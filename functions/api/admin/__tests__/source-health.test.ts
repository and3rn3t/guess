import { describe, expect, it } from 'vitest'
import { onRequestGet } from '../source-health'
import { buildEnv, createTestDb, invokeHandler, seedCharacter } from './harness'

describe('GET /api/admin/source-health', () => {
  it('returns source health report with summary and issues', async () => {
    const db = createTestDb()
    try {
      seedCharacter(db, 'c1', { name: 'Valid TMDB', category: 'movies' })
      db.raw
        .prepare('UPDATE characters SET source = ?, source_id = ?, popularity = ? WHERE id = ?')
        .run('tmdb', '101', 0.9, 'c1')

      seedCharacter(db, 'c2', { name: 'Missing ID', category: 'anime' })
      db.raw
        .prepare('UPDATE characters SET source = ?, source_id = ?, popularity = ? WHERE id = ?')
        .run('tmdb', '', 0.8, 'c2')

      seedCharacter(db, 'c3', { name: 'Malformed WD', category: 'comics' })
      db.raw
        .prepare('UPDATE characters SET source = ?, source_id = ?, popularity = ? WHERE id = ?')
        .run('wikidata', 'not-qid', 0.7, 'c3')

      const res = await invokeHandler<{
        totals: { totalCharacters: number; issueCount: number }
        perSource: Array<{ source: string; total: number; valid: number }>
        issues: Array<{ issueType: string; characterName: string }>
      }>(onRequestGet, {
        method: 'GET',
        env: buildEnv({ db }),
        url: 'https://example.com/api/admin/source-health?limit=10',
      })

      expect(res.status).toBe(200)
      expect(res.body.totals.totalCharacters).toBeGreaterThanOrEqual(3)
      expect(res.body.totals.issueCount).toBe(2)

      const tmdb = res.body.perSource.find((entry) => entry.source === 'tmdb')
      expect(tmdb?.total).toBe(2)
      expect(tmdb?.valid).toBe(1)

      expect(res.body.issues.map((issue) => issue.issueType)).toContain('missing-source-id')
      expect(res.body.issues.map((issue) => issue.issueType)).toContain('malformed-source-id')
    } finally {
      db.close()
    }
  })

  it('returns 503 when DB is missing', async () => {
    const res = await invokeHandler(onRequestGet, {
      method: 'GET',
      env: buildEnv(),
      url: 'https://example.com/api/admin/source-health',
    })

    expect(res.status).toBe(503)
  })
})
