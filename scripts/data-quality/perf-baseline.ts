#!/usr/bin/env npx tsx
/**
 * Performance + reliability baseline report for cleanup waves.
 *
 * Captures a point-in-time snapshot of key operational signals so follow-up
 * optimizations can be compared against a stable baseline.
 *
 * Usage:
 *   npx tsx scripts/data-quality/perf-baseline.ts --env production
 *   npx tsx scripts/data-quality/perf-baseline.ts --env preview --out /tmp/baseline.md
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface CountRow {
  n: number
}

interface SnapshotRow {
  captured_at: number
  data_health_score: number
  coverage_pct: number
  evidence_pct: number
  agreement_avg: number
  open_disputes: number
  closure_total_pairs: number | null
  closure_automation_pairs: number | null
  closure_manual_pairs: number | null
}

interface TableInfoRow {
  name: string
}

interface GameWindowRow {
  games_24h: number
  wins_24h: number
  games_7d: number
  wins_7d: number
}

function flag(name: string, fallback = ''): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function pct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'quality-reports')

const ENV_FLAG = flag('--env', 'production')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const dateLabel = new Date().toISOString().slice(0, 10)
const OUT_FILE = flag('--out', path.join(OUT_DIR, `perf-baseline-${ENV_FLAG}-${dateLabel}.md`))

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  )

  const parsed = JSON.parse(out) as Array<{ results: T[] }>
  return parsed[0]?.results ?? []
}

const snapshotColumns = new Set(
  d1<TableInfoRow>('PRAGMA table_info(data_quality_snapshots)').map((row) => row.name),
)
const errorLogColumns = new Set(
  d1<TableInfoRow>('PRAGMA table_info(error_logs)').map((row) => row.name),
)

function selectOrNull(column: string): string {
  if (snapshotColumns.has(column)) return column
  return `NULL AS ${column}`
}

const snapshotSelect = [
  'captured_at',
  'data_health_score',
  'coverage_pct',
  'evidence_pct',
  'agreement_avg',
  'open_disputes',
  selectOrNull('closure_total_pairs'),
  selectOrNull('closure_automation_pairs'),
  selectOrNull('closure_manual_pairs'),
].join(',\n      ')

const [currentSnapshot] = d1<SnapshotRow>(
  `SELECT
      ${snapshotSelect}
   FROM data_quality_snapshots
   ORDER BY captured_at DESC
   LIMIT 1`,
)

const [previousSnapshot] = d1<SnapshotRow>(
  `SELECT
      ${snapshotSelect}
   FROM data_quality_snapshots
   WHERE captured_at < unixepoch('now', '-7 days')
   ORDER BY captured_at DESC
   LIMIT 1`,
)

const [gameWindows] = d1<GameWindowRow>(
  `SELECT
      SUM(CASE WHEN created_at >= unixepoch('now', '-1 day') THEN 1 ELSE 0 END) AS games_24h,
      SUM(CASE WHEN created_at >= unixepoch('now', '-1 day') AND won = 1 THEN 1 ELSE 0 END) AS wins_24h,
      SUM(CASE WHEN created_at >= unixepoch('now', '-7 days') THEN 1 ELSE 0 END) AS games_7d,
      SUM(CASE WHEN created_at >= unixepoch('now', '-7 days') AND won = 1 THEN 1 ELSE 0 END) AS wins_7d
   FROM game_stats`,
)

const [openDisputes] = d1<CountRow>(
  `SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open'`,
)

const [criticalErrors24h] = d1<CountRow>(
  `SELECT COUNT(*) AS n
   FROM error_logs
   WHERE created_at >= unixepoch('now', '-1 day')
     AND level IN ('error', 'fatal')`,
)

const llmErrorsSql = errorLogColumns.has('path')
  ? `SELECT COUNT(*) AS n
     FROM error_logs
     WHERE created_at >= unixepoch('now', '-1 day')
       AND (path = '/api/llm' OR path = '/api/llm-stream')`
  : `SELECT 0 AS n`

const [llmErrors24h] = d1<CountRow>(
  llmErrorsSql,
)

const [charactersCount] = d1<CountRow>(`SELECT COUNT(*) AS n FROM characters`)
const [attributesCount] = d1<CountRow>(
  `SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1`,
)

const coverageDelta =
  previousSnapshot === undefined
    ? null
    : num(currentSnapshot?.coverage_pct) - num(previousSnapshot.coverage_pct)

const scoreDelta =
  previousSnapshot === undefined
    ? null
    : num(currentSnapshot?.data_health_score) - num(previousSnapshot.data_health_score)

const now = new Date().toISOString()
const games24h = Math.trunc(num(gameWindows?.games_24h))
const wins24h = Math.trunc(num(gameWindows?.wins_24h))
const games7d = Math.trunc(num(gameWindows?.games_7d))
const wins7d = Math.trunc(num(gameWindows?.wins_7d))

const winRate24h = games24h > 0 ? wins24h / games24h : 0
const winRate7d = games7d > 0 ? wins7d / games7d : 0
const coverageDeltaDisplay = coverageDelta === null ? '_n/a_' : `${(coverageDelta * 100).toFixed(3)}pp`

const lines = [
  `# Perf/Reliability Baseline (${ENV_FLAG})`,
  '',
  `> Generated: ${now}`,
  '',
  '## Core Signals',
  '',
  '| Metric | Value |',
  '|--------|-------|',
  `| Characters | ${Math.trunc(num(charactersCount?.n)).toLocaleString()} |`,
  `| Active attributes | ${Math.trunc(num(attributesCount?.n)).toLocaleString()} |`,
  `| Open disputes | ${Math.trunc(num(openDisputes?.n)).toLocaleString()} |`,
  `| Critical errors (24h) | ${Math.trunc(num(criticalErrors24h?.n)).toLocaleString()} |`,
  `| LLM endpoint errors (24h) | ${errorLogColumns.has('path') ? Math.trunc(num(llmErrors24h?.n)).toLocaleString() : '_n/a (path column missing)_'} |`,
  `| Games (24h) | ${games24h.toLocaleString()} |`,
  `| Win rate (24h) | ${pct(winRate24h)} |`,
  `| Games (7d) | ${games7d.toLocaleString()} |`,
  `| Win rate (7d) | ${pct(winRate7d)} |`,
  '',
  '## Data Quality Snapshot',
  '',
  '| Metric | Current | 7d Delta |',
  '|--------|---------|----------|',
  `| Data health score | ${num(currentSnapshot?.data_health_score).toFixed(4)} | ${scoreDelta === null ? '_n/a_' : scoreDelta.toFixed(4)} |`,
  `| Coverage | ${pct(num(currentSnapshot?.coverage_pct), 3)} | ${coverageDeltaDisplay} |`,
  `| Evidence coverage | ${pct(num(currentSnapshot?.evidence_pct), 3)} | _n/a_ |`,
  `| Agreement avg | ${num(currentSnapshot?.agreement_avg).toFixed(4)} | _n/a_ |`,
  `| Snapshot open disputes | ${Math.trunc(num(currentSnapshot?.open_disputes)).toLocaleString()} | _n/a_ |`,
  '',
  '## Closure Queue Snapshot',
  '',
  '| Metric | Value |',
  '|--------|-------|',
  `| Total queued pairs | ${Math.trunc(num(currentSnapshot?.closure_total_pairs)).toLocaleString()} |`,
  `| Automation lane pairs | ${Math.trunc(num(currentSnapshot?.closure_automation_pairs)).toLocaleString()} |`,
  `| Manual lane pairs | ${Math.trunc(num(currentSnapshot?.closure_manual_pairs)).toLocaleString()} |`,
  '',
  '## Notes',
  '',
  '- This report is intended to be checked in or attached to CI artifacts before optimization changes.',
  '- Compare against a post-change run with the same env to validate measurable improvements.',
  '',
  '---',
  '_Generated by scripts/data-quality/perf-baseline.ts_',
]

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, `${lines.join('\n')}\n`, 'utf8')

console.log(`[perf-baseline] env=${ENV_FLAG}`)
console.log(`[perf-baseline] output=${path.relative(REPO_ROOT, OUT_FILE)}`)
console.log(
  `[perf-baseline] games_24h=${games24h} win_rate_24h=${pct(winRate24h)} errors_24h=${Math.trunc(num(criticalErrors24h?.n))}`,
)
