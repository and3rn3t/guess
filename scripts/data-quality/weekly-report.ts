#!/usr/bin/env npx tsx
/**
 * DQ.38 — weekly completeness burndown report generator.
 *
 * Queries D1 for current null backlog, SLA misses, and closure velocity
 * (delta vs. last week's snapshot), then emits a markdown report to
 * data/quality-reports/quality-YYYY-WW.md.
 *
 * Usage:
 *   npx tsx scripts/data-quality/weekly-report.ts --env production
 *   npx tsx scripts/data-quality/weekly-report.ts --env preview --out /tmp/report.md
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { computeSlaMisses } from '../../functions/api/admin/data-quality/_completeness_burndown.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')

function flag(name: string, fallback = ''): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const ENV_FLAG = flag('--env', 'production')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const OUT_DIR = path.join(REPO_ROOT, 'data', 'quality-reports')
const DEFAULT_OUT = path.join(OUT_DIR, `quality-${isoWeek(new Date())}.md`)
const OUT_FILE = flag('--out', DEFAULT_OUT)

function isoWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  )
  const parsed = JSON.parse(out) as Array<{ results: T[] }>
  return parsed[0]?.results ?? []
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pct(v: number, decimals = 1): string {
  return `${(v * 100).toFixed(decimals)}%`
}

interface SlaConfig {
  categories: string[]
  rules: Array<{ attributeKey: string; targets: Record<string, number> }>
}

interface CountRow {
  n: number
}

interface AttrFillRow {
  attribute_key: string
  category: string
  filled: number
  total: number
}

interface SnapshotRow {
  captured_at: number
  coverage_pct: number
  evidence_pct: number
  closure_total_pairs: number | null
}

const SLA_PATH = path.join(REPO_ROOT, 'data', 'attribute-completeness-sla.json')
const sla = JSON.parse(readFileSync(SLA_PATH, 'utf8')) as SlaConfig
const CATEGORIES = sla.categories
const categoriesSql = CATEGORIES.map((c) => `'${c.replaceAll("'", "''")}'`).join(', ')
const slaKeys = [...new Set(sla.rules.map((r) => r.attributeKey))]
void slaKeys // available for future queue-aging SQL queries

// ── Fetch all data ────────────────────────────────────────────────────────────

const [activeAttrsRow] = d1<CountRow>('SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1')
const activeAttrs = Math.max(0, Math.trunc(num(activeAttrsRow?.n)))

const fillRows = d1<AttrFillRow>(
  `SELECT ca.attribute_key,
          c.category,
          COUNT(*) AS filled,
          COUNT(DISTINCT c.id) AS total
     FROM characters c
     JOIN attribute_definitions ad ON ad.is_active = 1
     LEFT JOIN character_attributes ca ON ca.character_id = c.id AND ca.attribute_key = ad.key AND ca.value IS NOT NULL
    WHERE c.category IN (${categoriesSql})
    GROUP BY ca.attribute_key, c.category`,
)

const charsCatRows = d1<{ category: string; n: number }>(
  `SELECT category, COUNT(*) AS n FROM characters WHERE category IN (${categoriesSql}) GROUP BY category`,
)

// Last two snapshots for velocity
const snapshotRows = d1<SnapshotRow>(
  `SELECT captured_at, coverage_pct, evidence_pct, closure_total_pairs
     FROM data_quality_snapshots
    ORDER BY captured_at DESC LIMIT 14`,
)

// ── Compute null backlog ──────────────────────────────────────────────────────

const charsCatMap = new Map<string, number>()
for (const row of charsCatRows) charsCatMap.set(row.category, Math.trunc(num(row.n)))

const totalChars = [...charsCatMap.values()].reduce((s, n) => s + n, 0)
const totalCells = totalChars * activeAttrs

// fill map: attrKey → category → filledCount
const fillMap = new Map<string, Map<string, number>>()
for (const row of fillRows) {
  if (!row.attribute_key) continue
  let byCategory = fillMap.get(row.attribute_key)
  if (!byCategory) {
    byCategory = new Map()
    fillMap.set(row.attribute_key, byCategory)
  }
  byCategory.set(row.category, Math.trunc(num(row.filled)))
}

let totalFilled = 0
const byCategoryBacklog: Record<string, { null: number; total: number }> = {}
for (const category of CATEGORIES) {
  const charCount = charsCatMap.get(category) ?? 0
  const categoryTotal = charCount * activeAttrs
  let categoryFilled = 0
  for (const [, byCategory] of fillMap) {
    categoryFilled += byCategory.get(category) ?? 0
  }
  totalFilled += categoryFilled
  byCategoryBacklog[category] = {
    null: Math.max(0, categoryTotal - categoryFilled),
    total: categoryTotal,
  }
}
const totalNull = Math.max(0, totalCells - totalFilled)
const fillRate = totalCells > 0 ? totalFilled / totalCells : 0

// ── SLA misses ────────────────────────────────────────────────────────────────

const actualByAttrCategory = new Map<string, ReadonlyMap<string, number>>()
for (const [attrKey, byCategory] of fillMap) {
  const actualMap = new Map<string, number>()
  for (const [category, filled] of byCategory) {
    const charCount = charsCatMap.get(category) ?? 0
    actualMap.set(category, charCount > 0 ? filled / charCount : 1)
  }
  actualByAttrCategory.set(attrKey, actualMap)
}
const slaMisses = computeSlaMisses(sla.rules, actualByAttrCategory)

// ── Closure velocity ──────────────────────────────────────────────────────────

// Compare current coverage_pct with the oldest snapshot in the last 7 days
const sevenDaysAgo = Date.now() / 1000 - 7 * 86400
const recentSnapshots = snapshotRows.filter((s) => s.captured_at >= sevenDaysAgo)
const lastWeekSnapshot = snapshotRows.find((s) => s.captured_at < sevenDaysAgo)

const currentCoverage = recentSnapshots[0]?.coverage_pct ?? fillRate
const lastWeekCoverage = lastWeekSnapshot?.coverage_pct
const velocityDelta =
  lastWeekCoverage !== undefined ? currentCoverage - lastWeekCoverage : null

// ── Write report ─────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

const now = new Date()
const weekLabel = isoWeek(now)
const dateStr = now.toISOString().slice(0, 10)

const topMisses = slaMisses.slice(0, 10)
const topNullCategories = CATEGORIES.map((cat) => ({
  category: cat,
  ...byCategoryBacklog[cat],
}))
  .filter((c) => c.null > 0)
  .sort((a, b) => b.null - a.null)
  .slice(0, 5)

function formatVelocity(delta: number | null): string {
  if (delta === null) return '_no prior snapshot_'
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${(delta * 100).toFixed(3)}pp`
}

const lines: string[] = [
  `# Data Quality Weekly Report — ${weekLabel}`,
  '',
  `> Generated: ${dateStr} | Env: ${ENV_FLAG}`,
  '',
  '## Summary',
  '',
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Null backlog | ${totalNull.toLocaleString()} cells |`,
  `| Fill rate | ${pct(fillRate, 2)} (${totalFilled.toLocaleString()} / ${totalCells.toLocaleString()}) |`,
  `| SLA misses | ${slaMisses.length} (attr × category pairs below target) |`,
  `| Coverage velocity (7d) | ${formatVelocity(velocityDelta)} |`,
  '',
  '## Null Backlog by Category',
  '',
  '| Category | Null Cells | Total Cells | Fill Rate |',
  '|----------|-----------|-------------|-----------|',
  ...CATEGORIES.map((cat) => {
    const { null: nullCount, total } = byCategoryBacklog[cat] ?? { null: 0, total: 0 }
    const catFill = total > 0 ? (total - nullCount) / total : 1
    return `| ${cat} | ${nullCount.toLocaleString()} | ${total.toLocaleString()} | ${pct(catFill)} |`
  }),
  '',
]

if (topMisses.length > 0) {
  lines.push(
    '## Top SLA Misses (by gap)',
    '',
    '| Attribute | Category | Target | Actual | Gap |',
    '|-----------|----------|--------|--------|-----|',
    ...topMisses.map(
      (m) =>
        `| ${m.attributeKey} | ${m.category} | ${pct(m.target)} | ${pct(m.actual)} | ${pct(m.gap)} |`,
    ),
    '',
  )
} else {
  lines.push('## SLA Misses', '', '_No SLA misses detected — all targets met._', '')
}

if (topNullCategories.length > 0) {
  lines.push(
    '## Highest-Impact Null Backlog (top 5 categories)',
    '',
    '| Category | Null Cells |',
    '|----------|-----------|',
    ...topNullCategories.map((c) => `| ${c.category} | ${c.null.toLocaleString()} |`),
    '',
  )
}

if (velocityDelta !== null) {
  const direction = velocityDelta > 0 ? 'improved' : velocityDelta < 0 ? 'regressed' : 'unchanged'
  lines.push(
    '## Closure Velocity',
    '',
    `Coverage ${direction} by **${formatVelocity(velocityDelta)}** over the last 7 days.`,
    '',
  )
}

lines.push(
  '## Next Steps',
  '',
  '- Address highest-gap SLA misses listed above.',
  '- Run `pnpm dq:null-closure:prod` to refresh the closure queue.',
  '- Review tier-1 risk sample in `data/risk-tier/` for recent drift.',
  '',
  `---`,
  `_Report generated by \`scripts/data-quality/weekly-report.ts\` (DQ.38)_`,
)

const report = lines.join('\n')
writeFileSync(OUT_FILE, report, 'utf8')
console.log(`[weekly-report] Written: ${OUT_FILE}`)
console.log(`[weekly-report] Null backlog: ${totalNull.toLocaleString()} cells | Fill rate: ${pct(fillRate, 2)} | SLA misses: ${slaMisses.length}`)
