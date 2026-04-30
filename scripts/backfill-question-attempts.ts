#!/usr/bin/env npx tsx
/**
 * Backfill question_attempts from existing game_stats.steps JSON.
 *
 * For every existing game_stats row we synthesize one question_attempts row per
 * step. Synthetic session_id = `legacy:{game_stats.id}` so re-running the script
 * is idempotent (legacy rows are deleted and re-inserted).
 *
 * Live games (post migration 0032) write question_attempts directly via
 * /api/v2/game/answer with their real session_id — those rows are untouched.
 *
 * Probability_delta and candidates_before/after are left NULL: the legacy
 * `steps` JSON does not contain candidate counts. The cron-aggregate worker can
 * derive empirical info-gain from neighbor-row analysis once enough live data
 * accumulates; backfill is for question popularity + answer distribution only.
 *
 * Usage:
 *   npx tsx scripts/backfill-question-attempts.ts [--apply] [--env preview|production] [--limit N]
 *
 * Defaults:
 *   --env production
 *   --limit 0 (no limit)
 *   dry-run unless --apply
 */

import { execFileSync } from 'node:child_process'

const APPLY = process.argv.includes('--apply')
const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? '0', 10) : 0
})()
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

interface GameStatsRow {
  id: number
  steps: string | null
  created_at: number
}

interface Step {
  questionText?: string
  attribute?: string
  answer?: string
}

function d1Exec<T = unknown>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function escapeSqlString(s: string): string {
  return `'${s.replaceAll("'", "''")}'`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main(): Promise<void> {
  console.log(`[backfill] env=${ENV_FLAG} db=${DB_NAME} apply=${APPLY} limit=${LIMIT || 'none'}`)

  const limitClause = LIMIT > 0 ? ` LIMIT ${LIMIT}` : ''
  const rows = d1Exec<GameStatsRow>(
    `SELECT id, steps, created_at FROM game_stats WHERE steps IS NOT NULL AND steps != '[]' ORDER BY id ASC${limitClause}`
  )
  console.log(`[backfill] found ${rows.length} game_stats rows with steps`)

  let totalInserts = 0
  const inserts: string[] = []

  for (const row of rows) {
    let steps: Step[]
    try {
      steps = JSON.parse(row.steps ?? '[]') as Step[]
    } catch {
      continue
    }
    if (!Array.isArray(steps) || steps.length === 0) continue

    const sessionId = `legacy:${row.id}`
    steps.forEach((step, idx) => {
      const attribute = step.attribute ?? ''
      const answer = step.answer ?? 'unknown'
      if (!attribute) return
      inserts.push(
        `(${escapeSqlString(sessionId)}, NULL, ${escapeSqlString(attribute)}, ${escapeSqlString(answer)}, NULL, NULL, NULL, ${idx}, ${row.created_at})`
      )
      totalInserts++
    })
  }

  console.log(`[backfill] would insert ${totalInserts} rows`)

  if (!APPLY) {
    console.log('[backfill] dry-run \u2014 pass --apply to execute')
    return
  }

  console.log('[backfill] purging existing legacy rows ...')
  d1Exec(`DELETE FROM question_attempts WHERE session_id LIKE 'legacy:%'`)

  // Batch inserts to keep individual SQL statements under D1's 100 KB limit.
  const batches = chunk(inserts, 200)
  console.log(`[backfill] inserting in ${batches.length} batches of \u2264200 rows each`)

  for (const [i, batch] of batches.entries()) {
    const sql = `INSERT INTO question_attempts (session_id, question_id, attribute, answer, probability_delta, candidates_before, candidates_after, question_index, created_at) VALUES ${batch.join(',')}`
    d1Exec(sql)
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`[backfill]   batch ${i + 1}/${batches.length} done`)
    }
  }

  console.log(`[backfill] complete \u2014 inserted ${totalInserts} rows`)
}

try {
  await main()
} catch (err) {
  console.error('[backfill] failed:', err)
  process.exit(1)
}
