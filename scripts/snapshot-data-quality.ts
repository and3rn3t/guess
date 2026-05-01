#!/usr/bin/env npx tsx
/**
 * DQ.7 — write a daily data-quality snapshot to the data_quality_snapshots
 * table so /admin/data-quality can render trend charts.
 *
 * Pure scoring lives in `functions/api/_data_health.ts` so it stays unit
 * tested. This script is the I/O wrapper: shells to wrangler, computes the
 * live metrics, then INSERTs one row.
 *
 * Usage:
 *   npx tsx scripts/snapshot-data-quality.ts [--env preview|production] \
 *       [--golden-pass-rate 0.97] [--vision-pass-rate 0.92] [--dry-run]
 *
 * --golden-pass-rate / --vision-pass-rate are optional and intended for CI
 * to inject the most-recent gate results (DQ.1 / DQ.2). When omitted, the
 * snapshot stores NULL for those columns and the dashboard hides the trend.
 *
 * Designed to run nightly via the existing adaptive-data-refresh Cron once
 * H.3 is wired; for now intended for manual + CI invocation.
 */

import { execFileSync } from 'node:child_process'

import { computeDataHealthScore } from '../functions/api/_data_health'

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ENV_FLAG = flag('--env') ?? 'production'
const DRY_RUN = process.argv.includes('--dry-run')
const GOLDEN = flag('--golden-pass-rate')
const VISION = flag('--vision-pass-rate')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

console.log(`[dq-snapshot] env=${ENV_FLAG} dry-run=${DRY_RUN}`)

const [chars] = d1<{ n: number }>('SELECT COUNT(*) AS n FROM characters')
const [activeAttrs] = d1<{ n: number }>(
  'SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1'
)
const [attrRows] = d1<{ n: number }>('SELECT COUNT(*) AS n FROM character_attributes')
const [evidenceRows] = d1<{ n: number }>(
  "SELECT COUNT(*) AS n FROM character_attributes WHERE evidence IS NOT NULL AND TRIM(evidence) <> ''"
)
const [agreement] = d1<{ avg: number | null }>(
  'SELECT AVG(agreement_score) AS avg FROM character_attributes WHERE agreement_score IS NOT NULL'
)
const [openDisputes] = d1<{ n: number }>(
  "SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open'"
)

const totalChars = num(chars?.n)
const totalAttrs = num(activeAttrs?.n)
const totalRows = num(attrRows?.n)
const totalEvidence = num(evidenceRows?.n)
const agreementAvg = num(agreement?.avg)
const openDisputeCount = num(openDisputes?.n)
const denomCells = totalChars * totalAttrs
const coveragePct = denomCells > 0 ? totalRows / denomCells : 0
const evidencePct = totalRows > 0 ? totalEvidence / totalRows : 0

const breakdown = computeDataHealthScore({
  coveragePct,
  evidencePct,
  agreementAvg,
  openDisputes: openDisputeCount,
  attributeRows: totalRows,
})

console.log('[dq-snapshot] metrics:')
console.log(`  characters       : ${totalChars.toLocaleString()}`)
console.log(`  active attrs     : ${totalAttrs.toLocaleString()}`)
console.log(`  attribute rows   : ${totalRows.toLocaleString()}`)
console.log(`  coverage         : ${(coveragePct * 100).toFixed(2)}%`)
console.log(`  evidence         : ${(evidencePct * 100).toFixed(2)}%`)
console.log(`  agreement avg    : ${(agreementAvg * 100).toFixed(2)}%`)
console.log(`  open disputes    : ${openDisputeCount.toLocaleString()}`)
console.log(`  golden pass rate : ${GOLDEN ?? '(none)'}`)
console.log(`  vision pass rate : ${VISION ?? '(none)'}`)
console.log(`  → data_health    : ${breakdown.score}`)

if (DRY_RUN) {
  console.log('[dq-snapshot] dry-run: skipping D1 write.')
  process.exit(0)
}

const golden = GOLDEN ? Number.parseFloat(GOLDEN) : null
const vision = VISION ? Number.parseFloat(VISION) : null
const sql = `INSERT INTO data_quality_snapshots
  (captured_at, data_health_score, coverage_pct, evidence_pct, agreement_avg, open_disputes, golden_pass_rate, vision_pass_rate)
  VALUES (unixepoch('now'), ${breakdown.score}, ${coveragePct}, ${evidencePct}, ${agreementAvg}, ${openDisputeCount}, ${golden ?? 'NULL'}, ${vision ?? 'NULL'});`

execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--command', sql],
  { stdio: 'inherit' }
)
console.log('[dq-snapshot] inserted snapshot row.')
