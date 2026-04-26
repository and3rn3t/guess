#!/usr/bin/env npx tsx
/**
 * Audit question bank health: coverage, info gain, duplicates, missing questions.
 *
 * Data sources:
 *   Local (default): data/staging.db — attribute_definitions, questions, character_attributes
 *   Remote (--remote): wrangler D1 — also pulls sim_game_stats + game_stats usage data
 *
 * Usage:
 *   npx tsx scripts/audit-questions.ts
 *   npx tsx scripts/audit-questions.ts --remote --env production
 *   npx tsx scripts/audit-questions.ts --remote --json
 */

import { execSync } from 'child_process'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

const STAGING_DB = 'data/staging.db'
const OUTPUT_JSON = 'data/attribute-audit.json'
const IS_REMOTE = process.argv.includes('--remote')
const WRITE_JSON = process.argv.includes('--json')
const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()

const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

// Known duplicate pairs: [canonical, alias] — alias should be merged into canonical
const KNOWN_DUPLICATES: [string, string][] = [
  ['fromVideoGame', 'isVideoGameCharacter'],
  ['fromMovie', 'isFromMovie'],
  ['fromBook', 'isFromBook'],
]

// Known zero-info attributes (every or no character has this attribute)
const KNOWN_ZERO_INFO = ['isFictional', 'isReal', 'livesInNewYork']

// ── Helpers ───────────────────────────────────────────────────────────────────

function d1Query(sql: string): unknown[] {
  const escaped = sql.replace(/"/g, '\\"')
  const out = execSync(
    `wrangler d1 execute ${DB_NAME} --env ${ENV_FLAG} --remote --json --command "${escaped}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: unknown[]; success: boolean }>
  return parsed[0]?.results ?? []
}

interface AttrRow {
  key: string
  display_text: string
  question_text: string | null
  is_active: number
}

interface QuestionRow {
  attribute_key: string
  text: string
  priority: number
  difficulty: string | null
}

interface CharAttrRow {
  attribute_key: string
  set_count: number
  yes_count: number
}

interface SimRow {
  attr: string
  avgGain: number
  simUsages: number
}

interface RealUsageRow {
  attr: string
  total: number
}

// ── Local DB queries ──────────────────────────────────────────────────────────

function localQuery<T>(db: InstanceType<typeof Database>, sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...params) as T[]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = new Database(STAGING_DB, { readonly: true })

  // Load attribute definitions
  const attrs = localQuery<AttrRow>(
    db,
    'SELECT key, display_text, question_text, is_active FROM attribute_definitions ORDER BY key'
  )

  // Load questions table
  const questionsRaw = localQuery<QuestionRow>(
    db,
    'SELECT attribute_key, text, priority, difficulty FROM questions'
  )
  const questionsMap = new Map(questionsRaw.map((q) => [q.attribute_key, q]))

  // Character attribute coverage: how many characters have each attribute set (non-null)
  const charAttrs = localQuery<CharAttrRow>(
    db,
    `SELECT
       attribute_key,
       COUNT(*) AS set_count,
       SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS yes_count
     FROM character_attributes
     GROUP BY attribute_key`
  )
  const charAttrMap = new Map(charAttrs.map((r) => [r.attribute_key, r]))

  // Total character count
  const totalChars = (db.prepare('SELECT COUNT(*) as n FROM characters WHERE is_active = 1').get() as { n: number }).n

  // Remote: simulation info gain + real usage
  const simGainMap = new Map<string, { avgGain: number; simUsages: number }>()
  const realUsageMap = new Map<string, number>()

  if (IS_REMOTE) {
    process.stderr.write('Fetching sim_game_stats from D1...\n')
    const simRows = d1Query(
      `SELECT json_extract(q.value, '$.attribute') as attr,
              AVG(CAST(json_extract(q.value, '$.infoGain') AS REAL)) as avgGain,
              COUNT(*) as simUsages
       FROM sim_game_stats sgs, json_each(sgs.questions_sequence) q
       GROUP BY attr`
    ) as SimRow[]
    for (const r of simRows) simGainMap.set(r.attr, { avgGain: r.avgGain, simUsages: r.simUsages })

    process.stderr.write('Fetching game_stats from D1...\n')
    const realRows = d1Query(
      `SELECT key as attr, SUM(CAST(value AS INTEGER)) as total
       FROM game_stats, json_each(game_stats.answer_distribution)
       WHERE answer_distribution IS NOT NULL
       GROUP BY key`
    ) as RealUsageRow[]
    for (const r of realRows) realUsageMap.set(r.attr, r.total)
  }

  db.close()

  // ── Build audit rows ──────────────────────────────────────────────────────

  type Flag = 'DUPLICATE' | 'ZERO_INFO' | 'LOW_COVERAGE' | 'NO_QUESTION' | 'NO_DIFFICULTY'
  interface AuditRow {
    key: string
    displayText: string
    isActive: boolean
    hasQuestion: boolean
    questionText: string | null
    questionDifficulty: string | null
    coveragePct: number
    yesPct: number
    avgInfoGain: number | null
    simUsages: number | null
    realUsages: number | null
    score: number
    flags: Flag[]
  }

  const rows: AuditRow[] = []

  for (const attr of attrs) {
    const charData = charAttrMap.get(attr.key)
    const questionRow = questionsMap.get(attr.key)
    const simData = simGainMap.get(attr.key)
    const realUsages = realUsageMap.get(attr.key) ?? null

    const setCnt = charData?.set_count ?? 0
    const yesCnt = charData?.yes_count ?? 0
    const coveragePct = totalChars > 0 ? Math.round((setCnt / totalChars) * 100) : 0
    const yesPct = setCnt > 0 ? Math.round((yesCnt / setCnt) * 100) : 0

    const avgInfoGain = simData?.avgGain ?? null
    const simUsages = simData?.simUsages ?? null

    const flags: Flag[] = []
    if (KNOWN_DUPLICATES.some(([a, b]) => a === attr.key || b === attr.key)) flags.push('DUPLICATE')
    if (KNOWN_ZERO_INFO.includes(attr.key)) flags.push('ZERO_INFO')
    if (coveragePct < 40 && attr.is_active) flags.push('LOW_COVERAGE')
    if (!questionRow && attr.is_active) flags.push('NO_QUESTION')
    if (questionRow && !questionRow.difficulty && attr.is_active) flags.push('NO_DIFFICULTY')

    const score = (realUsages ?? 0) * (avgInfoGain ?? 0)

    rows.push({
      key: attr.key,
      displayText: attr.display_text,
      isActive: !!attr.is_active,
      hasQuestion: !!questionRow,
      questionText: questionRow?.text ?? attr.question_text,
      questionDifficulty: questionRow?.difficulty ?? null,
      coveragePct,
      yesPct,
      avgInfoGain,
      simUsages,
      realUsages,
      score,
      flags,
    })
  }

  // Sort by score descending (active first, then by score)
  rows.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return b.score - a.score
  })

  // ── Print table ───────────────────────────────────────────────────────────

  const flagSymbols: Record<Flag, string> = {
    DUPLICATE: '⚠ DUP',
    ZERO_INFO: '⚠ ZERO',
    LOW_COVERAGE: '⚠ LOW_COV',
    NO_QUESTION: '⚠ NO_Q',
    NO_DIFFICULTY: '· NO_DIFF',
  }

  const colW = { key: 36, cov: 6, yes: 5, gain: 7, sim: 6, real: 6, flags: 40 }

  const header = [
    'attribute_key'.padEnd(colW.key),
    'cov%'.padStart(colW.cov),
    'yes%'.padStart(colW.yes),
    'gain'.padStart(colW.gain),
    'sim#'.padStart(colW.sim),
    'real#'.padStart(colW.real),
    'flags',
  ].join('  ')

  console.log('\n=== Attribute Audit ===')
  console.log(`Chars: ${totalChars}  Attrs: ${rows.filter((r) => r.isActive).length} active / ${rows.length} total`)
  console.log()
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const r of rows) {
    if (!r.isActive) continue
    const flagStr = r.flags.map((f) => flagSymbols[f]).join(' ')
    console.log(
      [
        r.key.padEnd(colW.key),
        `${r.coveragePct}%`.padStart(colW.cov),
        `${r.yesPct}%`.padStart(colW.yes),
        (r.avgInfoGain != null ? r.avgInfoGain.toFixed(4) : 'n/a').padStart(colW.gain),
        (r.simUsages != null ? String(r.simUsages) : 'n/a').padStart(colW.sim),
        (r.realUsages != null ? String(r.realUsages) : 'n/a').padStart(colW.real),
        flagStr,
      ].join('  ')
    )
  }

  // Summary
  const flagCounts = { DUPLICATE: 0, ZERO_INFO: 0, LOW_COVERAGE: 0, NO_QUESTION: 0, NO_DIFFICULTY: 0 } as Record<Flag, number>
  for (const r of rows) {
    if (!r.isActive) continue
    for (const f of r.flags) flagCounts[f]++
  }
  console.log()
  console.log('--- Issues (active attrs) ---')
  for (const [flag, count] of Object.entries(flagCounts)) {
    if (count > 0) console.log(`  ${flag}: ${count}`)
  }
  console.log()

  // ── JSON output ───────────────────────────────────────────────────────────

  if (WRITE_JSON) {
    const outPath = path.resolve(OUTPUT_JSON)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2))
    console.log(`Wrote ${rows.length} rows → ${outPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
