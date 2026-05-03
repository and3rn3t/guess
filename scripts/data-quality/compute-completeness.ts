#!/usr/bin/env npx tsx
/**
 * DQ.31 - compute canonical completeness metrics + gate verdict.
 *
 * This is the CI/ops entrypoint for completeness checks. It shells out to
 * wrangler D1, computes completeness using the pure scoring helper, and prints
 * a deterministic summary.
 *
 * Usage:
 *   npx tsx scripts/data-quality/compute-completeness.ts --env preview
 *   npx tsx scripts/data-quality/compute-completeness.ts --env production --gate-mode warn
 *   npx tsx scripts/data-quality/compute-completeness.ts --env production --gate-mode fail --ci
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { computeDataCompletenessScore } from '../../functions/api/_data_completeness'

interface SlaRule {
  attributeKey: string
  targets: Record<string, number>
}

interface SlaConfig {
  version: number
  updatedAt: string
  categories: string[]
  global: {
    warnScore: number
    failScore: number
    defaultCategoryFloor: number
    disputeBudget: number
  }
  rules: SlaRule[]
}

interface CountRow {
  n: number
}

interface CategoryCountRow {
  category: string
  n: number
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ENV_FLAG = flag('--env') ?? 'production'
const GATE_MODE = (flag('--gate-mode') ?? 'off').toLowerCase()
const IS_CI = process.argv.includes('--ci')
const JSON_ONLY = process.argv.includes('--json')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SLA_PATH = path.join(REPO_ROOT, 'data', 'attribute-completeness-sla.json')

function loadSlaConfig(): SlaConfig {
  const raw = readFileSync(SLA_PATH, 'utf8')
  return JSON.parse(raw) as SlaConfig
}

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
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

function main(): void {
  const sla = loadSlaConfig()

  const [activeAttrsRow] = d1<CountRow>(
    'SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1'
  )
  const [filledRequiredRow] = d1<CountRow>(
    `SELECT COUNT(*) AS n
       FROM character_attributes ca
       JOIN attribute_definitions ad ON ad.key = ca.attribute_key
      WHERE ad.is_active = 1 AND ca.value IS NOT NULL`
  )
  const [evidenceRowsRow] = d1<CountRow>(
    `SELECT COUNT(*) AS n
       FROM character_attributes ca
       JOIN attribute_definitions ad ON ad.key = ca.attribute_key
      WHERE ad.is_active = 1
        AND ca.value IS NOT NULL
        AND ca.evidence IS NOT NULL
        AND TRIM(ca.evidence) <> ''`
  )
  const [sourceCoverageRow] = d1<CountRow>(
    `SELECT COUNT(*) AS n
       FROM characters
      WHERE source = 'default' OR (source_id IS NOT NULL AND TRIM(source_id) <> '')`
  )
  const [openHighDisputesRow] = d1<CountRow>(
    "SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open' AND confidence >= 0.8"
  )

  const charsByCategoryRows = d1<CategoryCountRow>(
    'SELECT category, COUNT(*) AS n FROM characters GROUP BY category'
  )
  const filledByCategoryRows = d1<CategoryCountRow>(
    `SELECT c.category AS category, COUNT(*) AS n
       FROM characters c
       LEFT JOIN character_attributes ca ON ca.character_id = c.id AND ca.value IS NOT NULL
       LEFT JOIN attribute_definitions ad ON ad.key = ca.attribute_key
      WHERE ad.is_active = 1
      GROUP BY c.category`
  )

  const activeAttrs = Math.max(0, Math.trunc(num(activeAttrsRow?.n)))
  const filledRequired = Math.max(0, Math.trunc(num(filledRequiredRow?.n)))
  const evidenceRows = Math.max(0, Math.trunc(num(evidenceRowsRow?.n)))
  const sourceCoverageCount = Math.max(0, Math.trunc(num(sourceCoverageRow?.n)))
  const openHighDisputes = Math.max(0, Math.trunc(num(openHighDisputesRow?.n)))

  const charsByCategory = new Map<string, number>()
  for (const row of charsByCategoryRows) {
    charsByCategory.set(row.category, Math.max(0, Math.trunc(num(row.n))))
  }

  const filledByCategory = new Map<string, number>()
  for (const row of filledByCategoryRows) {
    filledByCategory.set(row.category, Math.max(0, Math.trunc(num(row.n))))
  }

  const totalChars = [...charsByCategory.values()].reduce((sum, n) => sum + n, 0)
  const totalRequiredCells = totalChars * activeAttrs
  const globalCompleteness = totalRequiredCells > 0 ? filledRequired / totalRequiredCells : 0
  const evidenceCoverage = filledRequired > 0 ? evidenceRows / filledRequired : 0
  const sourceIdCoverage = totalChars > 0 ? sourceCoverageCount / totalChars : 0

  const categoryCompleteness: Record<string, number> = {}
  for (const category of sla.categories) {
    const categoryChars = charsByCategory.get(category) ?? 0
    const categoryRequiredCells = categoryChars * activeAttrs
    const categoryFilledCells = filledByCategory.get(category) ?? 0
    categoryCompleteness[category] =
      categoryRequiredCells > 0 ? categoryFilledCells / categoryRequiredCells : 1
  }

  const result = computeDataCompletenessScore({
    globalCompleteness,
    categoryCompleteness,
    evidenceCoverage,
    sourceIdCoverage,
    openHighPriorityDisputes: openHighDisputes,
    disputeBudget: sla.global.disputeBudget,
    categoryFloorThreshold: sla.global.defaultCategoryFloor,
    warnScoreThreshold: sla.global.warnScore,
    failScoreThreshold: sla.global.failScore,
  })

  const payload = {
    env: ENV_FLAG,
    gateMode: GATE_MODE,
    inputs: {
      totalCharacters: totalChars,
      activeAttributes: activeAttrs,
      totalRequiredCells,
      filledRequiredCells: filledRequired,
      evidenceRows,
      sourceCoverageCount,
      openHighPriorityDisputes: openHighDisputes,
      categoryCompleteness,
    },
    result,
  }

  if (JSON_ONLY) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log('DQ completeness check')
    console.log('---------------------')
    console.log(`env                     : ${ENV_FLAG}`)
    console.log(`gate mode               : ${GATE_MODE}`)
    console.log(`total characters        : ${totalChars.toLocaleString()}`)
    console.log(`active attributes       : ${activeAttrs.toLocaleString()}`)
    console.log(`required cells          : ${totalRequiredCells.toLocaleString()}`)
    console.log(`filled required cells   : ${filledRequired.toLocaleString()} (${pct(globalCompleteness)})`)
    console.log(`evidence coverage       : ${pct(evidenceCoverage)}`)
    console.log(`source-id coverage      : ${pct(sourceIdCoverage)}`)
    console.log(`open high disputes      : ${openHighDisputes.toLocaleString()} / ${result.gate.disputeBudget}`)
    console.log(`category floor score    : ${pct(result.categoryFloorScore)}`)
    console.log(`data_complete_score     : ${result.score.toFixed(4)} (${pct(result.score)})`)

    if (result.gate.categoriesBelowFloor.length > 0) {
      console.log(`categories below floor  : ${result.gate.categoriesBelowFloor.join(', ')}`)
    } else {
      console.log('categories below floor  : none')
    }

    if (result.gate.fail) {
      console.log('gate verdict            : FAIL')
    } else if (result.gate.warn) {
      console.log('gate verdict            : WARN')
    } else {
      console.log('gate verdict            : PASS')
    }
  }

  if (IS_CI && result.gate.warn) {
    const warning = `data completeness gate warning (score=${result.score.toFixed(4)})`
    console.log(`::warning::${warning}`)
  }

  if (GATE_MODE === 'fail' && result.gate.fail) {
    process.exit(1)
  }
}

main()
