/**
 * DQ.35 — Image health completeness guardrail.
 *
 * Computes image health status for characters from D1 rows.
 * Tracks % of characters with usable portraits across different quality tiers.
 *
 * Image health assessment:
 * - Present: image_url is not NULL
 * - Valid R2 URL: image_url matches expected `/api/images/{characterId}/*.webp` pattern
 * - Likely usable: URL is present and valid (not a placeholder or broken external link)
 * - Degraded: NULL image_url or non-R2 URL (external source may be unreliable/slow)
 * - Missing: NULL image_url
 *
 * Future enhancements:
 * - HEAD request to R2 to verify existence + size
 * - Vision model assessment for quality/relevance
 * - Art style consistency check (pairs with DQ.2)
 */

export interface ImageHealthCharacterRow {
  id: string
  name: string
  category: string
  popularity: number | null
  image_url: string | null
  created_at: number | null
}

export type ImageHealthIssueType = 'missing-url' | 'invalid-url' | 'external-url'

export interface ImageHealthIssue {
  characterId: string
  characterName: string
  category: string
  issueType: ImageHealthIssueType
  reason: string
  popularity: number
  createdAt: number
}

export interface ImageHealthPerCategory {
  category: string
  total: number
  withImage: number
  validR2Url: number
  imageCoveragePct: number
}

export interface ImageHealthReport {
  generatedAt: string
  totals: {
    totalCharacters: number
    withImage: number
    validR2Url: number
    missingUrl: number
    invalidUrl: number
    externalUrl: number
    usablePct: number
  }
  perCategory: ImageHealthPerCategory[]
  issues: ImageHealthIssue[]
}

export const IMAGE_HEALTH_REPORT_KEY = 'admin:data-quality:image-health:last'

function isValidR2Url(url: string | null): boolean {
  if (!url) return false
  // Valid pattern: /api/images/{characterId}/profile.webp or /api/images/{characterId}/thumb.webp
  return /^\/api\/images\/[\w-]+\/(profile|thumb)\.webp$/.test(url)
}

function classifyImageUrl(url: string | null): ImageHealthIssueType | null {
  if (!url || url.trim() === '') return 'missing-url'
  if (isValidR2Url(url)) return null // Valid
  if (url.startsWith('/api/images/')) return 'invalid-url' // Malformed R2 URL
  return 'external-url' // External URL (not from R2)
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function computeImageHealthReport(
  rows: ImageHealthCharacterRow[],
  options: { issueLimit?: number } = {},
): ImageHealthReport {
  const { issueLimit = 200 } = options

  // Tally by category
  const categoryMap = new Map<string, { total: number; withImage: number; validR2Url: number }>()

  let totalCharacters = 0
  let withImage = 0
  let validR2Url = 0
  let missingUrl = 0
  let invalidUrl = 0
  let externalUrl = 0

  const issues: ImageHealthIssue[] = []

  for (const row of rows) {
    totalCharacters++

    const cat = row.category || 'unknown'
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, withImage: 0, validR2Url: 0 })
    }
    const stats = categoryMap.get(cat)!
    stats.total++

    const issueType = classifyImageUrl(row.image_url)

    if (!issueType) {
      // Valid R2 image
      validR2Url++
      withImage++
      stats.validR2Url++
      stats.withImage++
    } else {
      // Invalid or missing image
      if (issueType === 'missing-url') {
        missingUrl++
      } else if (issueType === 'invalid-url') {
        invalidUrl++
        withImage++ // Has URL but malformed
        stats.withImage++
      } else if (issueType === 'external-url') {
        externalUrl++
        withImage++ // Has URL but not R2-hosted
        stats.withImage++
      }

      // Track as an issue if we haven't hit the limit yet
      if (issues.length < issueLimit) {
        let reason = ''
        if (issueType === 'missing-url') reason = 'No image URL set'
        else if (issueType === 'invalid-url') reason = 'Malformed R2 image URL'
        else if (issueType === 'external-url') reason = 'External image URL (not R2-hosted)'

        issues.push({
          characterId: row.id,
          characterName: row.name,
          category: cat,
          issueType,
          reason,
          popularity: num(row.popularity),
          createdAt: num(row.created_at),
        })
      }
    }
  }

  // Sort issues by popularity (descending) so high-profile characters show first
  issues.sort((a, b) => b.popularity - a.popularity)

  // Compute per-category stats
  const perCategory = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      withImage: stats.withImage,
      validR2Url: stats.validR2Url,
      imageCoveragePct: stats.total > 0 ? stats.validR2Url / stats.total : 0,
    }))
    .sort((a, b) => a.category.localeCompare(b.category))

  const usablePct = totalCharacters > 0 ? validR2Url / totalCharacters : 0

  const report: ImageHealthReport = {
    generatedAt: new Date().toISOString(),
    totals: {
      totalCharacters,
      withImage,
      validR2Url,
      missingUrl,
      invalidUrl,
      externalUrl,
      usablePct,
    },
    perCategory,
    issues: issues.slice(0, issueLimit),
  }

  return report
}
