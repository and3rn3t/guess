/**
 * GET  /api/admin/data-quality — DQ.7 continuous quality dashboard.
 *
 * Returns a live "right now" snapshot computed from D1 plus a trend window
 * of historical snapshots (defaults to 30 days) sourced from the
 * data_quality_snapshots table that the nightly cron writes.
 *
 * Protected by the Basic-auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import { computeDataCompletenessScore } from '../_data_completeness'
import { computeDataHealthScore } from '../_data_health'
import { DQ31_DEFAULTS, DQ_CATEGORIES } from './data-quality/_sla_matrix'

interface SnapshotRow {
  captured_at: number
  data_health_score: number
  coverage_pct: number
  evidence_pct: number
  agreement_avg: number
  open_disputes: number
  golden_pass_rate: number | null
  vision_pass_rate: number | null
  closure_total_pairs: number | null
  closure_automation_pairs: number | null
  closure_manual_pairs: number | null
}

interface CountRow {
  n: number
}

interface CategoryCountRow {
  category: string
  n: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const days = Math.min(Math.max(Number.parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 1), 365)

  const [
    charsRow,
    activeAttrsRow,
    attrRowsRow,
    evidenceRowsRow,
    filledActiveRow,
    evidenceActiveRow,
    sourceCoverageRow,
    openHighDisputesRow,
    charsByCategoryRows,
    filledByCategoryRows,
    agreementRow,
    openDisputesRow,
    history,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM characters').first<{ n: number }>(),
    db
      .prepare('SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1')
      .first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM character_attributes').first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM character_attributes WHERE evidence IS NOT NULL AND TRIM(evidence) <> ''")
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n
           FROM character_attributes ca
           JOIN attribute_definitions ad ON ad.key = ca.attribute_key
          WHERE ad.is_active = 1 AND ca.value IS NOT NULL`
      )
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n
           FROM character_attributes ca
           JOIN attribute_definitions ad ON ad.key = ca.attribute_key
          WHERE ad.is_active = 1
            AND ca.value IS NOT NULL
            AND ca.evidence IS NOT NULL
            AND TRIM(ca.evidence) <> ''`
      )
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n
           FROM characters
          WHERE source = 'default' OR (source_id IS NOT NULL AND TRIM(source_id) <> '')`
      )
      .first<CountRow>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open' AND confidence >= 0.8")
      .first<CountRow>(),
    db.prepare('SELECT category, COUNT(*) AS n FROM characters GROUP BY category').all<CategoryCountRow>(),
    db
      .prepare(
        `SELECT c.category AS category, COUNT(*) AS n
           FROM characters c
           LEFT JOIN character_attributes ca ON ca.character_id = c.id AND ca.value IS NOT NULL
           LEFT JOIN attribute_definitions ad ON ad.key = ca.attribute_key
          WHERE ad.is_active = 1
          GROUP BY c.category`
      )
      .all<CategoryCountRow>(),
    db
      .prepare('SELECT AVG(agreement_score) AS avg, COUNT(*) AS n FROM character_attributes WHERE agreement_score IS NOT NULL')
      .first<{ avg: number | null; n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open'")
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT captured_at, data_health_score, coverage_pct, evidence_pct,
          agreement_avg, open_disputes, golden_pass_rate, vision_pass_rate,
          closure_total_pairs, closure_automation_pairs, closure_manual_pairs
           FROM data_quality_snapshots
          WHERE captured_at >= unixepoch('now', '-' || ?1 || ' days')
          ORDER BY captured_at ASC`
      )
      .bind(days)
      .all<SnapshotRow>(),
  ])

  const totalChars = charsRow?.n ?? 0
  const activeAttrs = activeAttrsRow?.n ?? 0
  const attrRows = attrRowsRow?.n ?? 0
  const evidenceRows = evidenceRowsRow?.n ?? 0
  const agreementAvg = agreementRow?.avg ?? 0
  const agreementSampleSize = agreementRow?.n ?? 0
  const openDisputes = openDisputesRow?.n ?? 0

  const denomCells = totalChars * activeAttrs
  const coveragePct = denomCells > 0 ? attrRows / denomCells : 0
  const evidencePct = attrRows > 0 ? evidenceRows / attrRows : 0

  const filledActiveRows = filledActiveRow?.n ?? 0
  const evidenceActiveRows = evidenceActiveRow?.n ?? 0
  const sourceCoverageCount = sourceCoverageRow?.n ?? 0
  const openHighPriorityDisputes = openHighDisputesRow?.n ?? 0

  const charsByCategory = new Map<string, number>()
  for (const row of charsByCategoryRows.results ?? []) {
    charsByCategory.set(row.category, row.n)
  }

  const filledByCategory = new Map<string, number>()
  for (const row of filledByCategoryRows.results ?? []) {
    filledByCategory.set(row.category, row.n)
  }

  const categoryCompleteness: Record<string, number> = {}
  for (const category of DQ_CATEGORIES) {
    const categoryChars = charsByCategory.get(category) ?? 0
    const categoryRequiredCells = categoryChars * activeAttrs
    const categoryFilledCells = filledByCategory.get(category) ?? 0
    categoryCompleteness[category] = categoryRequiredCells > 0 ? categoryFilledCells / categoryRequiredCells : 1
  }

  const totalRequiredCells = totalChars * activeAttrs
  const globalCompleteness = totalRequiredCells > 0 ? filledActiveRows / totalRequiredCells : 0
  const evidenceCoverage = filledActiveRows > 0 ? evidenceActiveRows / filledActiveRows : 0
  const sourceIdCoverage = totalChars > 0 ? sourceCoverageCount / totalChars : 0

  const completeness = computeDataCompletenessScore({
    globalCompleteness,
    categoryCompleteness,
    evidenceCoverage,
    sourceIdCoverage,
    openHighPriorityDisputes,
    disputeBudget: DQ31_DEFAULTS.disputeBudget,
    categoryFloorThreshold: DQ31_DEFAULTS.defaultCategoryFloor,
    warnScoreThreshold: DQ31_DEFAULTS.warnScore,
    failScoreThreshold: DQ31_DEFAULTS.failScore,
  })

  const breakdown = computeDataHealthScore({
    coveragePct,
    evidencePct,
    agreementAvg,
    openDisputes,
    attributeRows: attrRows,
  })

  return jsonResponse({
    live: {
      capturedAt: Math.floor(Date.now() / 1000),
      dataHealthScore: breakdown.score,
      components: breakdown.components,
      weights: breakdown.weights,
      coveragePct,
      evidencePct,
      agreementAvg,
      agreementSampleSize,
      openDisputes,
      totalCharacters: totalChars,
      activeAttributes: activeAttrs,
      attributeRows: attrRows,
      completeness: {
        dataCompleteScore: completeness.score,
        components: completeness.components,
        weights: completeness.weights,
        categoryFloorScore: completeness.categoryFloorScore,
        categoryCompleteness,
        globalCompleteness,
        evidenceCoverage,
        sourceIdCoverage,
        openHighPriorityDisputes,
        totalRequiredCells,
        filledRequiredCells: filledActiveRows,
        gate: completeness.gate,
        config: DQ31_DEFAULTS,
      },
    },
    history: history.results ?? [],
    windowDays: days,
  })
}
