import { describe, expect, it } from 'vitest'
import { computeSourceHealthReport } from './_source_health'

describe('computeSourceHealthReport', () => {
  it('classifies missing, malformed, and unknown source issues with per-source coverage', () => {
    const report = computeSourceHealthReport([
      {
        id: 'c1',
        name: 'Alpha',
        category: 'anime',
        source: 'tmdb',
        source_id: '123',
        popularity: 0.9,
        created_at: 1,
      },
      {
        id: 'c2',
        name: 'Beta',
        category: 'anime',
        source: 'tmdb',
        source_id: '',
        popularity: 0.8,
        created_at: 1,
      },
      {
        id: 'c3',
        name: 'Gamma',
        category: 'comics',
        source: 'wikidata',
        source_id: 'bad',
        popularity: 0.7,
        created_at: 1,
      },
      {
        id: 'c4',
        name: 'Delta',
        category: 'movies',
        source: 'my-custom-source',
        source_id: 'x',
        popularity: 0.6,
        created_at: 1,
      },
      {
        id: 'c5',
        name: 'Epsilon',
        category: 'books',
        source: 'default',
        source_id: null,
        popularity: 0.5,
        created_at: 1,
      },
      {
        id: 'c6',
        name: 'Zeta',
        category: 'games',
        source: null,
        source_id: null,
        popularity: 0.4,
        created_at: 1,
      },
    ])

    expect(report.totals.totalCharacters).toBe(6)
    expect(report.totals.validCharacters).toBe(2)
    expect(report.totals.issueCount).toBe(4)

    const tmdb = report.perSource.find((row) => row.source === 'tmdb')
    expect(tmdb).toBeDefined()
    expect(tmdb?.total).toBe(2)
    expect(tmdb?.valid).toBe(1)
    expect(tmdb?.missing).toBe(1)

    const wikidata = report.perSource.find((row) => row.source === 'wikidata')
    expect(wikidata?.total).toBe(1)
    expect(wikidata?.malformed).toBe(1)

    expect(report.issues.some((issue) => issue.issueType === 'unknown-source')).toBe(true)
    expect(report.issues.some((issue) => issue.issueType === 'missing-source')).toBe(true)
  })

  it('applies issue limit after sorting by popularity', () => {
    const report = computeSourceHealthReport(
      [
        {
          id: 'c1',
          name: 'High',
          category: 'anime',
          source: 'tmdb',
          source_id: null,
          popularity: 1,
          created_at: 1,
        },
        {
          id: 'c2',
          name: 'Low',
          category: 'anime',
          source: 'tmdb',
          source_id: null,
          popularity: 0.1,
          created_at: 1,
        },
      ],
      { issueLimit: 1 },
    )

    expect(report.totals.issueCount).toBe(2)
    expect(report.issues).toHaveLength(1)
    expect(report.issues[0]?.characterName).toBe('High')
  })

  it('computes aging from character created_at and sorts by age descending', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const tenDaysAgo = nowSeconds - 10 * 86400
    const fiveDaysAgo = nowSeconds - 5 * 86400

    const report = computeSourceHealthReport([
      {
        id: 'old-char',
        name: 'OldChar',
        category: 'anime',
        source: 'tmdb',
        source_id: '',
        popularity: 0.5,
        created_at: tenDaysAgo,
      },
      {
        id: 'new-char',
        name: 'NewChar',
        category: 'anime',
        source: 'tmdb',
        source_id: '',
        popularity: 0.8,
        created_at: fiveDaysAgo,
      },
    ])

    expect(report.issues).toHaveLength(2)
    expect(report.issues[0]?.characterName).toBe('OldChar')
    expect(report.issues[0]?.agedDays).toBeGreaterThanOrEqual(9)
    expect(report.issues[0]?.createdAt).toBe(tenDaysAgo)
    expect(report.issues[1]?.characterName).toBe('NewChar')
    expect(report.issues[1]?.agedDays).toBeGreaterThanOrEqual(4)
  })
})
