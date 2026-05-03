#!/usr/bin/env npx tsx
/**
 * DQ.34 — source-ID completeness guardrail report.
 *
 * Computes source health from live D1 and emits a deterministic JSON artifact
 * for automation and admin surfaces.
 *
 * Usage:
 *   npx tsx scripts/data-quality/check-source-ids.ts --env preview
 *   npx tsx scripts/data-quality/check-source-ids.ts --env production --limit 300
 *   npx tsx scripts/data-quality/check-source-ids.ts --env preview --json
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { computeSourceHealthReport, type SourceHealthCharacterRow } from '../../functions/api/_source_health'

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ENV_FLAG = flag('--env') ?? 'production'
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const ISSUE_LIMIT = Math.min(Math.max(Number.parseInt(flag('--limit') ?? '200', 10) || 200, 1), 1000)
const JSON_ONLY = process.argv.includes('--json')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'source-health')

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

function main(): void {
  const rows = d1<SourceHealthCharacterRow>(
    `SELECT id, name, category, source, source_id, popularity, created_at
       FROM characters`,
  )

  const report = computeSourceHealthReport(rows, { issueLimit: ISSUE_LIMIT })

  const output = {
    env: ENV_FLAG,
    db: DB_NAME,
    issueLimit: ISSUE_LIMIT,
    ...report,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `source-health-${ENV_FLAG}-${report.generatedAt.slice(0, 10)}.json`)
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  if (JSON_ONLY) {
    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log('DQ source-ID health')
  console.log('-------------------')
  console.log(`env                     : ${ENV_FLAG}`)
  console.log(`total characters        : ${output.totals.totalCharacters.toLocaleString()}`)
  console.log(`valid source IDs        : ${output.totals.validCharacters.toLocaleString()} (${pct(output.totals.coveragePct)})`)
  console.log(`issues                  : ${output.totals.issueCount.toLocaleString()}`)
  console.log(`report path             : ${outPath}`)

  for (const source of output.perSource) {
    console.log(
      `  - ${source.source}: valid=${source.valid}/${source.total} (${pct(source.coveragePct)}) missing=${source.missing} malformed=${source.malformed}`,
    )
  }
}

main()
