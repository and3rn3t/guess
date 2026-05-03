import { describe, expect, it } from 'vitest'
import { computeImageHealthReport, type ImageHealthCharacterRow } from './_image_health'

describe('_image_health.ts', () => {
  it('computes report from character rows with varied image URLs', () => {
    const rows: ImageHealthCharacterRow[] = [
      {
        id: 'c1',
        name: 'Valid R2',
        category: 'movies',
        popularity: 0.9,
        image_url: '/api/images/c1/profile.webp',
        created_at: 1704067200, // 2024-01-01
      },
      {
        id: 'c2',
        name: 'Valid R2 thumb',
        category: 'movies',
        popularity: 0.8,
        image_url: '/api/images/c2/thumb.webp',
        created_at: 1704067200,
      },
      {
        id: 'c3',
        name: 'Missing URL',
        category: 'anime',
        popularity: 0.7,
        image_url: null,
        created_at: 1704067200,
      },
      {
        id: 'c4',
        name: 'External URL',
        category: 'comics',
        popularity: 0.6,
        image_url: 'https://example.com/image.jpg',
        created_at: 1704067200,
      },
      {
        id: 'c5',
        name: 'Malformed R2',
        category: 'comics',
        popularity: 0.5,
        image_url: '/api/images/c5/large.jpg',
        created_at: 1704067200,
      },
    ]

    const report = computeImageHealthReport(rows, { issueLimit: 100 })

    expect(report.totals.totalCharacters).toBe(5)
    expect(report.totals.validR2Url).toBe(2)
    expect(report.totals.withImage).toBe(4) // Has URL set
    expect(report.totals.missingUrl).toBe(1)
    expect(report.totals.externalUrl).toBe(1)
    expect(report.totals.invalidUrl).toBe(1)
    expect(report.totals.usablePct).toBe(2 / 5) // 2 valid out of 5

    // Check per-category stats
    const moviesStats = report.perCategory.find((cat) => cat.category === 'movies')
    expect(moviesStats?.total).toBe(2)
    expect(moviesStats?.validR2Url).toBe(2)
    expect(moviesStats?.imageCoveragePct).toBe(1.0)

    const animeStats = report.perCategory.find((cat) => cat.category === 'anime')
    expect(animeStats?.total).toBe(1)
    expect(animeStats?.validR2Url).toBe(0)
    expect(animeStats?.imageCoveragePct).toBe(0)

    // Check issues are tracked and sorted by popularity
    expect(report.issues.length).toBeGreaterThanOrEqual(3)
    expect(report.issues[0].popularity).toBeGreaterThanOrEqual(report.issues[1].popularity)

    // Verify specific issues
    const missingIssue = report.issues.find((issue) => issue.issueType === 'missing-url')
    expect(missingIssue?.characterName).toBe('Missing URL')

    const externalIssue = report.issues.find((issue) => issue.issueType === 'external-url')
    expect(externalIssue?.characterName).toBe('External URL')

    const invalidIssue = report.issues.find((issue) => issue.issueType === 'invalid-url')
    expect(invalidIssue?.characterName).toBe('Malformed R2')
  })

  it('limits issues to issueLimit parameter', () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({
      id: `c${i}`,
      name: `Character ${i}`,
      category: i % 3 === 0 ? 'movies' : i % 3 === 1 ? 'anime' : 'comics',
      popularity: Math.random(),
      image_url: null, // All missing
      created_at: 1704067200,
    }))

    const report = computeImageHealthReport(rows, { issueLimit: 50 })

    expect(report.issues.length).toBe(50)
    expect(report.totals.missingUrl).toBe(300)
  })

  it('generates ISO timestamp', () => {
    const rows: ImageHealthCharacterRow[] = []
    const report = computeImageHealthReport(rows)

    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('handles empty rows', () => {
    const report = computeImageHealthReport([])

    expect(report.totals.totalCharacters).toBe(0)
    expect(report.totals.usablePct).toBe(0)
    expect(report.perCategory.length).toBe(0)
    expect(report.issues.length).toBe(0)
  })
})
