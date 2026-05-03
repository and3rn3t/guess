/// <reference types="@cloudflare/workers-types" />

import { computeDataHealthScore } from '../api/_data_health'
import { handleBackfill } from '../api/admin/questions/duplicates/_handlers'
import { computeRetirementQueue, type RetirementAttemptRow, type RetirementSkipRow } from '../api/admin/_retirement'
import { runServerEnrichBatch } from '../api/admin/enrich/run'
import {
  buildClosureQueueReport,
  CLOSURE_QUEUE_REPORT_KEY,
  type ClosureQueueReport,
} from '../api/admin/data-quality/_closure_queue'
import {
  computeSourceHealthReport,
  SOURCE_HEALTH_REPORT_KEY,
  type SourceHealthCharacterRow,
  type SourceHealthReport,
} from '../api/_source_health'

export interface AutomationEnv {
  GUESS_DB?: D1Database
  GUESS_KV?: KVNamespace
  GUESS_ASSETS?: KVNamespace
  OPENAI_API_KEY?: string
  AI?: Ai
  AUTO_CAPTURE_DQ_SNAPSHOT?: string
  AUTO_DUPLICATES_BACKFILL?: string
  AUTO_DUPLICATES_LIMIT?: string
  AUTO_ENRICH_ONE?: string
  AUTO_CLOSURE_QUEUE?: string
  AUTO_CLOSURE_QUEUE_LIMIT?: string
  AUTO_SOURCE_HEALTH?: string
  AUTO_SOURCE_HEALTH_LIMIT?: string
  AUTO_RETIRE_ENABLED?: string
  AUTO_RETIRE_LIMIT?: string
  AUTO_RETIRE_MIN_SCORE?: string
  AUTO_RETIRE_MIN_SHOWN?: string
  AUTO_RETIRE_WINDOW_DAYS?: string
}

export interface AutomationSummary {
  ranAt: number
  cron: string
  durationMs: number
  errorCount: number
  snapshot: 'inserted' | 'skipped' | 'error'
  duplicatesEmbedded: number
  enrichmentKick: 'started' | 'skipped' | 'error'
  closureQueue: {
    status: 'generated' | 'skipped' | 'error'
    totalCandidatePairs: number
    totalPairs: number
    automationPairs: number
    manualPairs: number
  }
  sourceHealth: {
    status: 'generated' | 'skipped' | 'error'
    totalCharacters: number
    validCharacters: number
    issueCount: number
    coveragePct: number
  }
  retiredQuestions: number
  stepDurationsMs: {
    snapshot: number
    duplicates: number
    enrichment: number
    closureQueue: number
    sourceHealth: number
    retirement: number
  }
  stepErrors: {
    snapshot: string | null
    duplicates: string | null
    enrichment: string | null
    closureQueue: string | null
    sourceHealth: string | null
    retirement: string | null
  }
  notes: string[]
}

const AUTOMATION_REPORT_KEY = 'admin:automation:last-run'

function flagEnabled(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes'
}

function parseIntClamped(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function parseFloatClamped(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(raw ?? '')
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

async function maybeCaptureDataQualitySnapshot(
  env: AutomationEnv,
  closureSummary?: {
    totalPairs: number
    automationPairs: number
    manualPairs: number
  },
): Promise<'inserted' | 'skipped' | 'error'> {
  if (!env.GUESS_DB) return 'skipped'
  if (!flagEnabled(env.AUTO_CAPTURE_DQ_SNAPSHOT, true)) return 'skipped'

  try {
    const existing = await env.GUESS_DB
      .prepare("SELECT COUNT(*) AS n FROM data_quality_snapshots WHERE captured_at >= unixepoch(date('now'))")
      .first<{ n: number }>()
    if ((existing?.n ?? 0) > 0) return 'skipped'

    const [chars, activeAttrs, attrRows, evidenceRows, agreement, disputes] = await Promise.all([
      env.GUESS_DB.prepare('SELECT COUNT(*) AS n FROM characters').first<{ n: number }>(),
      env.GUESS_DB.prepare('SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1').first<{ n: number }>(),
      env.GUESS_DB.prepare('SELECT COUNT(*) AS n FROM character_attributes').first<{ n: number }>(),
      env.GUESS_DB
        .prepare("SELECT COUNT(*) AS n FROM character_attributes WHERE evidence IS NOT NULL AND TRIM(evidence) <> ''")
        .first<{ n: number }>(),
      env.GUESS_DB
        .prepare('SELECT AVG(agreement_score) AS avg FROM character_attributes WHERE agreement_score IS NOT NULL')
        .first<{ avg: number | null }>(),
      env.GUESS_DB
        .prepare("SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open'")
        .first<{ n: number }>(),
    ])

    const totalChars = chars?.n ?? 0
    const totalAttrs = activeAttrs?.n ?? 0
    const totalRows = attrRows?.n ?? 0
    const evidence = evidenceRows?.n ?? 0
    const agreementAvg = agreement?.avg ?? 0
    const openDisputes = disputes?.n ?? 0
    const denom = totalChars * totalAttrs

    const coveragePct = denom > 0 ? totalRows / denom : 0
    const evidencePct = totalRows > 0 ? evidence / totalRows : 0
    const breakdown = computeDataHealthScore({
      coveragePct,
      evidencePct,
      agreementAvg,
      openDisputes,
      attributeRows: totalRows,
    })

    await env.GUESS_DB.prepare(
      `INSERT INTO data_quality_snapshots
        (
          captured_at,
          data_health_score,
          coverage_pct,
          evidence_pct,
          agreement_avg,
          open_disputes,
          closure_total_pairs,
          closure_automation_pairs,
          closure_manual_pairs
        )
       VALUES (unixepoch('now'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        breakdown.score,
        coveragePct,
        evidencePct,
        agreementAvg,
        openDisputes,
        closureSummary?.totalPairs ?? null,
        closureSummary?.automationPairs ?? null,
        closureSummary?.manualPairs ?? null,
      )
      .run()

    return 'inserted'
  } catch {
    return 'error'
  }
}

async function maybeBackfillDuplicateEmbeddings(env: AutomationEnv): Promise<number> {
  if (!env.GUESS_DB || !env.AI) return 0
  if (!flagEnabled(env.AUTO_DUPLICATES_BACKFILL, true)) return 0

  const limit = parseIntClamped(env.AUTO_DUPLICATES_LIMIT, 40, 1, 200)
  const request = new Request('https://cron.local/api/admin/questions/duplicates/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  })

  const response = await handleBackfill({
    env: env as unknown,
    request,
    params: {},
    waitUntil: () => {},
    next: async () => new Response(null, { status: 404 }),
    data: {},
  } as unknown as Parameters<typeof handleBackfill>[0])

  if (!response.ok) return 0
  const json = await response.json() as { embedded?: number }
  return json.embedded ?? 0
}

async function maybeKickEnrichment(env: AutomationEnv, batchId: string): Promise<'started' | 'skipped' | 'error'> {
  if (!env.GUESS_DB || !env.GUESS_KV) return 'skipped'
  if (!env.OPENAI_API_KEY) return 'skipped'
  if (!flagEnabled(env.AUTO_ENRICH_ONE, true)) return 'skipped'

  try {
    const running = await env.GUESS_KV.get('admin:enrich-start')
    if (running) return 'skipped'

    await runServerEnrichBatch(env as unknown as Parameters<typeof runServerEnrichBatch>[0], batchId)
    return 'started'
  } catch {
    return 'error'
  }
}

async function maybeMaterializeClosureQueue(
  env: AutomationEnv,
): Promise<{ status: 'generated' | 'skipped' | 'error'; report: ClosureQueueReport | null }> {
  if (!env.GUESS_DB) return { status: 'skipped', report: null }
  if (!flagEnabled(env.AUTO_CLOSURE_QUEUE, true)) return { status: 'skipped', report: null }

  const limit = parseIntClamped(env.AUTO_CLOSURE_QUEUE_LIMIT, 200, 1, 500)

  try {
    const report = await buildClosureQueueReport(env.GUESS_DB, limit)
    const kv = env.GUESS_ASSETS ?? env.GUESS_KV
    if (kv) {
      await kv.put(CLOSURE_QUEUE_REPORT_KEY, JSON.stringify(report), {
        expirationTtl: 8 * 24 * 60 * 60,
      })
    }
    return { status: 'generated', report }
  } catch {
    return { status: 'error', report: null }
  }
}

async function maybeMaterializeSourceHealth(
  env: AutomationEnv,
): Promise<{ status: 'generated' | 'skipped' | 'error'; report: SourceHealthReport | null }> {
  if (!env.GUESS_DB) return { status: 'skipped', report: null }
  if (!flagEnabled(env.AUTO_SOURCE_HEALTH, true)) return { status: 'skipped', report: null }

  const issueLimit = parseIntClamped(env.AUTO_SOURCE_HEALTH_LIMIT, 200, 1, 1000)

  try {
    const rowsResult = await env.GUESS_DB
      .prepare(
        `SELECT id, name, category, source, source_id, popularity, created_at
           FROM characters`,
      )
      .all<SourceHealthCharacterRow>()

    const rows = rowsResult.results ?? []
    const report = computeSourceHealthReport(rows, { issueLimit })

    const kv = env.GUESS_ASSETS ?? env.GUESS_KV
    if (kv) {
      await kv.put(SOURCE_HEALTH_REPORT_KEY, JSON.stringify(report), {
        expirationTtl: 8 * 24 * 60 * 60,
      })
    }

    return { status: 'generated', report }
  } catch {
    return { status: 'error', report: null }
  }
}

async function maybeAutoRetireQuestions(env: AutomationEnv): Promise<number> {
  if (!env.GUESS_DB) return 0
  if (!flagEnabled(env.AUTO_RETIRE_ENABLED, false)) return 0

  const windowDays = parseIntClamped(env.AUTO_RETIRE_WINDOW_DAYS, 30, 1, 365)
  const minShown = parseIntClamped(env.AUTO_RETIRE_MIN_SHOWN, 20, 1, 10000)
  const limit = parseIntClamped(env.AUTO_RETIRE_LIMIT, 3, 1, 50)
  const minScore = parseFloatClamped(env.AUTO_RETIRE_MIN_SCORE, 0.9, 0, 1)

  const sinceSecs = `unixepoch('now', '-${windowDays} days')`
  const sinceMs = `unixepoch('now', '-${windowDays} days') * 1000`

  const [attempts, skips] = await Promise.all([
    env.GUESS_DB
      .prepare(
        `SELECT
           qa.question_id AS question_id,
           q.text         AS text,
           q.attribute_key AS attribute_key,
           COUNT(*)       AS shown,
           SUM(CASE WHEN qa.answer = 'yes'     THEN 1 ELSE 0 END) AS yes,
           SUM(CASE WHEN qa.answer = 'no'      THEN 1 ELSE 0 END) AS no,
           SUM(CASE WHEN qa.answer = 'maybe'   THEN 1 ELSE 0 END) AS maybe,
           SUM(CASE WHEN qa.answer = 'unknown' THEN 1 ELSE 0 END) AS unknown
         FROM question_attempts qa
         INNER JOIN questions q ON q.id = qa.question_id
         WHERE qa.question_id IS NOT NULL
           AND qa.created_at >= ${sinceSecs}
           AND q.retired_at IS NULL
         GROUP BY qa.question_id
         HAVING shown >= ?`,
      )
      .bind(minShown)
      .all<RetirementAttemptRow>(),

    env.GUESS_DB
      .prepare(
        `SELECT
           json_extract(ce.data, '$.questionId') AS question_id,
           COUNT(*) AS skips
         FROM client_events ce
         WHERE ce.event_type = 'question_skip'
           AND ce.created_at >= ${sinceMs}
           AND json_extract(ce.data, '$.questionId') IS NOT NULL
         GROUP BY question_id`,
      )
      .all<RetirementSkipRow>(),
  ])

  const candidates = computeRetirementQueue(
    attempts.results ?? [],
    skips.results ?? [],
    { minShown, limit: 200 },
  )

  const toRetire = candidates
    .filter((candidate) => candidate.retirementScore >= minScore)
    .slice(0, limit)

  let retired = 0
  const retiredAt = Date.now()
  for (const candidate of toRetire) {
    const result = await env.GUESS_DB
      .prepare(
        `UPDATE questions
         SET retired_at = ?, retired_reason = ?
         WHERE attribute_key = ? AND retired_at IS NULL`,
      )
      .bind(
        retiredAt,
        `auto-retire: score=${candidate.retirementScore.toFixed(3)} shown=${candidate.shown} skipRate=${candidate.skipRate.toFixed(3)}`,
        candidate.attributeKey,
      )
      .run()
    retired += result.meta.changes ?? 0
  }

  return retired
}

export async function runAdminAutomation(
  trigger: { cron: string; scheduledTime: number },
  env: AutomationEnv,
  log: (msg: unknown) => void = console.log,
): Promise<AutomationSummary> {
  const startedAt = Date.now()
  const summary: AutomationSummary = {
    ranAt: trigger.scheduledTime,
    cron: trigger.cron,
    durationMs: 0,
    errorCount: 0,
    snapshot: 'skipped',
    duplicatesEmbedded: 0,
    enrichmentKick: 'skipped',
    closureQueue: {
      status: 'skipped',
      totalCandidatePairs: 0,
      totalPairs: 0,
      automationPairs: 0,
      manualPairs: 0,
    },
    sourceHealth: {
      status: 'skipped',
      totalCharacters: 0,
      validCharacters: 0,
      issueCount: 0,
      coveragePct: 0,
    },
    retiredQuestions: 0,
    stepDurationsMs: {
      snapshot: 0,
      duplicates: 0,
      enrichment: 0,
      closureQueue: 0,
      sourceHealth: 0,
      retirement: 0,
    },
    stepErrors: {
      snapshot: null,
      duplicates: null,
      enrichment: null,
      closureQueue: null,
      sourceHealth: null,
      retirement: null,
    },
    notes: [],
  }

  if (!env.GUESS_DB) {
    summary.notes.push('automation skipped: DB unavailable')
  } else {
    {
      const t0 = Date.now()
      try {
        summary.duplicatesEmbedded = await maybeBackfillDuplicateEmbeddings(env)
        if (summary.duplicatesEmbedded > 0) {
          summary.notes.push(`duplicate embeddings backfilled: ${summary.duplicatesEmbedded}`)
        }
      } catch (err) {
        summary.errorCount += 1
        summary.stepErrors.duplicates = (err as Error).message
        summary.notes.push('duplicate backfill failed')
      } finally {
        summary.stepDurationsMs.duplicates = Date.now() - t0
      }
    }

    {
      const t0 = Date.now()
      try {
        summary.enrichmentKick = await maybeKickEnrichment(env, `cron-${trigger.scheduledTime}`)
        if (summary.enrichmentKick === 'error') {
          summary.errorCount += 1
          summary.stepErrors.enrichment = 'enrichment run returned error status'
          summary.notes.push('enrichment kick failed')
        }
      } catch (err) {
        summary.enrichmentKick = 'error'
        summary.errorCount += 1
        summary.stepErrors.enrichment = (err as Error).message
        summary.notes.push('enrichment kick failed')
      } finally {
        summary.stepDurationsMs.enrichment = Date.now() - t0
      }
    }

    {
      const t0 = Date.now()
      try {
        const closure = await maybeMaterializeClosureQueue(env)
        const report = closure.report
        summary.closureQueue = {
          status: closure.status,
          totalCandidatePairs: report?.totalCandidatePairs ?? 0,
          totalPairs: report?.summary.totalPairs ?? 0,
          automationPairs: report?.summary.automationPairs ?? 0,
          manualPairs: report?.summary.manualPairs ?? 0,
        }
        if (closure.status === 'error') {
          summary.errorCount += 1
          summary.stepErrors.closureQueue = 'closure queue run returned error status'
          summary.notes.push('closure queue materialization failed')
        } else if (closure.status === 'generated') {
          summary.notes.push(
            `closure queue materialized: ${summary.closureQueue.totalPairs}/${summary.closureQueue.totalCandidatePairs}`,
          )
        }
      } catch (err) {
        summary.errorCount += 1
        summary.closureQueue.status = 'error'
        summary.stepErrors.closureQueue = (err as Error).message
        summary.notes.push('closure queue materialization failed')
      } finally {
        summary.stepDurationsMs.closureQueue = Date.now() - t0
      }
    }

    {
      const t0 = Date.now()
      try {
        const sourceHealth = await maybeMaterializeSourceHealth(env)
        const report = sourceHealth.report
        summary.sourceHealth = {
          status: sourceHealth.status,
          totalCharacters: report?.totals.totalCharacters ?? 0,
          validCharacters: report?.totals.validCharacters ?? 0,
          issueCount: report?.totals.issueCount ?? 0,
          coveragePct: report?.totals.coveragePct ?? 0,
        }
        if (sourceHealth.status === 'error') {
          summary.errorCount += 1
          summary.stepErrors.sourceHealth = 'source health run returned error status'
          summary.notes.push('source health materialization failed')
        } else if (sourceHealth.status === 'generated') {
          summary.notes.push(
            `source health materialized: ${summary.sourceHealth.validCharacters}/${summary.sourceHealth.totalCharacters}`,
          )
        }
      } catch (err) {
        summary.errorCount += 1
        summary.sourceHealth.status = 'error'
        summary.stepErrors.sourceHealth = (err as Error).message
        summary.notes.push('source health materialization failed')
      } finally {
        summary.stepDurationsMs.sourceHealth = Date.now() - t0
      }
    }

    {
      const t0 = Date.now()
      try {
        const closureForSnapshot =
          summary.closureQueue.status === 'generated'
            ? {
                totalPairs: summary.closureQueue.totalPairs,
                automationPairs: summary.closureQueue.automationPairs,
                manualPairs: summary.closureQueue.manualPairs,
              }
            : undefined
        summary.snapshot = await maybeCaptureDataQualitySnapshot(env, closureForSnapshot)
        if (summary.snapshot === 'error') {
          summary.errorCount += 1
          summary.stepErrors.snapshot = 'snapshot run returned error status'
          summary.notes.push('snapshot failed')
        }
      } catch (err) {
        summary.snapshot = 'error'
        summary.errorCount += 1
        summary.stepErrors.snapshot = (err as Error).message
        summary.notes.push('snapshot failed')
      } finally {
        summary.stepDurationsMs.snapshot = Date.now() - t0
      }
    }

    {
      const t0 = Date.now()
      try {
        summary.retiredQuestions = await maybeAutoRetireQuestions(env)
        if (summary.retiredQuestions > 0) {
          summary.notes.push(`questions auto-retired: ${summary.retiredQuestions}`)
        }
      } catch (err) {
        summary.errorCount += 1
        summary.stepErrors.retirement = (err as Error).message
        summary.notes.push('auto-retire failed')
      } finally {
        summary.stepDurationsMs.retirement = Date.now() - t0
      }
    }
  }

  summary.durationMs = Date.now() - startedAt

  const kv = env.GUESS_ASSETS ?? env.GUESS_KV
  if (kv) {
    await kv.put(AUTOMATION_REPORT_KEY, JSON.stringify(summary), { expirationTtl: 7 * 24 * 60 * 60 })
  }

  log({ event: 'cron.automation', ...summary })
  return summary
}
