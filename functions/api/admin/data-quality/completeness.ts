/**
 * GET /api/admin/data-quality/completeness
 *
 * DQ.38 — completeness burndown view.
 *
 * Returns:
 *   nullBacklog   — total null cells + per-category breakdown + top-N attrs by null count
 *   slaMisses     — attributes below their SLA target per category (sorted by gap desc)
 *   queueAging    — age distribution of characters with outstanding null SLA attrs
 *   weeklyTrend   — last N weeks of coverage_pct + evidence_pct from snapshots
 *   capturedAt    — Unix timestamp of this response
 *
 * Protected by the Basic-auth gate in functions/_middleware.ts.
 */
import { type Env, errorResponse, jsonResponse } from '../../_helpers'
import { computeQueueAging, computeSlaMisses } from './_completeness_burndown'
import { DQ33_RULES, DQ_CATEGORIES } from './_sla_matrix'

interface ActiveAttrRow {
  attribute_key: string
}

interface FillRow {
  attribute_key: string
  category: string
  filled: number
}

interface CharsCatRow {
  category: string
  n: number
}

interface AgingRow {
  created_at: number
}

interface SnapshotRow {
  week_start: string
  coverage_pct: number
  evidence_pct: number
  null_cells: number | null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const topN = Math.min(Math.max(Number.parseInt(url.searchParams.get('topN') ?? '20', 10) || 20, 1), 100)
  const weeks = Math.min(Math.max(Number.parseInt(url.searchParams.get('weeks') ?? '8', 10) || 8, 1), 52)

  const categoriesSql = DQ_CATEGORIES.map((c) => `'${c.replaceAll("'", "''")}'`).join(', ')
  const slaKeys = [...new Set(DQ33_RULES.map((r) => r.attributeKey))]
  const slaKeysSql = slaKeys.map((k) => `'${k.replaceAll("'", "''")}'`).join(', ')

  const [activeAttrsResult, fillResult, charsCatResult, agingResult, snapshotsResult] =
    await Promise.all([
      db
        .prepare(`SELECT key AS attribute_key FROM attribute_definitions WHERE is_active = 1`)
        .all<ActiveAttrRow>(),
      db
        .prepare(
          `SELECT ca.attribute_key, c.category, COUNT(*) AS filled
             FROM character_attributes ca
             JOIN characters c ON c.id = ca.character_id
             JOIN attribute_definitions ad ON ad.key = ca.attribute_key AND ad.is_active = 1
            WHERE ca.value IS NOT NULL
              AND c.category IN (${categoriesSql})
            GROUP BY ca.attribute_key, c.category`,
        )
        .all<FillRow>(),
      db
        .prepare(
          `SELECT category, COUNT(*) AS n FROM characters WHERE category IN (${categoriesSql}) GROUP BY category`,
        )
        .all<CharsCatRow>(),
      // Queue aging: characters that have at least one null SLA-tracked attribute
      db
        .prepare(
          `SELECT DISTINCT c.created_at
             FROM characters c
             JOIN attribute_definitions ad ON ad.is_active = 1 AND ad.key IN (${slaKeysSql})
             LEFT JOIN character_attributes ca ON ca.character_id = c.id AND ca.attribute_key = ad.key
            WHERE ca.value IS NULL
              AND c.category IN (${categoriesSql})`,
        )
        .all<AgingRow>(),
      // Weekly trend: one snapshot per calendar week, last N weeks
      db
        .prepare(
          `SELECT
              strftime('%Y-W%W', datetime(captured_at, 'unixepoch')) AS week_start,
              AVG(coverage_pct) AS coverage_pct,
              AVG(evidence_pct) AS evidence_pct,
              MIN(coverage_pct) AS null_cells
             FROM data_quality_snapshots
            WHERE captured_at >= unixepoch('now', '-' || ?1 || ' days')
            GROUP BY week_start
            ORDER BY week_start ASC`,
        )
        .bind(weeks * 7)
        .all<SnapshotRow>(),
    ])

  const activeAttrs = activeAttrsResult.results ?? []
  const activeAttrCount = activeAttrs.length

  // Build fill map: attrKey → category → filledCount
  const fillMap = new Map<string, Map<string, number>>()
  for (const row of fillResult.results ?? []) {
    let byCategory = fillMap.get(row.attribute_key)
    if (!byCategory) {
      byCategory = new Map()
      fillMap.set(row.attribute_key, byCategory)
    }
    byCategory.set(row.category, row.filled)
  }

  // Build chars-per-category map
  const charsCatMap = new Map<string, number>()
  for (const row of charsCatResult.results ?? []) {
    charsCatMap.set(row.category, row.n)
  }

  // Compute null backlog
  let totalNull = 0
  let totalCells = 0
  const byCategoryRecord: Record<string, { nullCount: number; totalCount: number; fillRate: number }> = {}

  for (const category of DQ_CATEGORIES) {
    const charCount = charsCatMap.get(category) ?? 0
    const categoryTotal = charCount * activeAttrCount
    let categoryFilled = 0
    for (const [, byCategory] of fillMap) {
      categoryFilled += byCategory.get(category) ?? 0
    }
    const categoryNull = Math.max(0, categoryTotal - categoryFilled)
    totalNull += categoryNull
    totalCells += categoryTotal
    byCategoryRecord[category] = {
      nullCount: categoryNull,
      totalCount: categoryTotal,
      fillRate: categoryTotal > 0 ? Math.round(((categoryTotal - categoryNull) / categoryTotal) * 10000) / 10000 : 1,
    }
  }

  // Top-N attrs by null count
  const attrNullCounts: { attributeKey: string; nullCount: number }[] = []
  for (const attr of activeAttrs) {
    const byCategory = fillMap.get(attr.attribute_key) ?? new Map<string, number>()
    let attrFilled = 0
    let attrTotal = 0
    for (const category of DQ_CATEGORIES) {
      const charCount = charsCatMap.get(category) ?? 0
      attrTotal += charCount
      attrFilled += byCategory.get(category) ?? 0
    }
    attrNullCounts.push({ attributeKey: attr.attribute_key, nullCount: Math.max(0, attrTotal - attrFilled) })
  }
  attrNullCounts.sort((a, b) => b.nullCount - a.nullCount)

  // SLA misses
  const actualByAttrCategory = new Map<string, ReadonlyMap<string, number>>()
  for (const [attrKey, byCategory] of fillMap) {
    const actualByCategory = new Map<string, number>()
    for (const [category, filled] of byCategory) {
      const total = (charsCatMap.get(category) ?? 0)
      actualByCategory.set(category, total > 0 ? filled / total : 1)
    }
    actualByAttrCategory.set(attrKey, actualByCategory)
  }
  const slaMisses = computeSlaMisses(DQ33_RULES, actualByAttrCategory)

  // Queue aging
  const agingItems = (agingResult.results ?? []).map((row) => ({ createdAtSec: row.created_at }))
  const queueAging = computeQueueAging(agingItems)

  return jsonResponse({
    nullBacklog: {
      totalNull,
      totalCells,
      fillRate: totalCells > 0 ? Math.round(((totalCells - totalNull) / totalCells) * 10000) / 10000 : 1,
      byCategory: byCategoryRecord,
      topAttributes: attrNullCounts.slice(0, topN),
    },
    slaMisses,
    slaMissCount: slaMisses.length,
    queueAging,
    weeklyTrend: (snapshotsResult.results ?? []).map((row) => ({
      weekStart: row.week_start,
      coveragePct: Math.round((row.coverage_pct ?? 0) * 10000) / 10000,
      evidencePct: Math.round((row.evidence_pct ?? 0) * 10000) / 10000,
    })),
    capturedAt: Math.floor(Date.now() / 1000),
  })
}
