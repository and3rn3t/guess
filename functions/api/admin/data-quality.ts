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
import { computeDataHealthScore } from '../_data_health'

interface SnapshotRow {
  captured_at: number
  data_health_score: number
  coverage_pct: number
  evidence_pct: number
  agreement_avg: number
  open_disputes: number
  golden_pass_rate: number | null
  vision_pass_rate: number | null
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
      .prepare('SELECT AVG(agreement_score) AS avg, COUNT(*) AS n FROM character_attributes WHERE agreement_score IS NOT NULL')
      .first<{ avg: number | null; n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open'")
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT captured_at, data_health_score, coverage_pct, evidence_pct,
                agreement_avg, open_disputes, golden_pass_rate, vision_pass_rate
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
    },
    history: history.results ?? [],
    windowDays: days,
  })
}
