#!/usr/bin/env npx tsx
/**
 * Calibration check — Phase 6d.
 *
 * Compares real-world win rates from `game_stats` against simulator
 * predictions from `sim_game_stats`, grouped by `guess_trigger`. Flags any
 * trigger whose real and sim win rates differ by more than the configured
 * threshold (default 5 percentage points).
 *
 * Exit codes:
 *   0  — all triggers within threshold (or insufficient data, with warning)
 *   1  — at least one trigger out of calibration
 *
 * Usage:
 *   npx tsx scripts/calibration-check.ts [--env preview|production]
 *                                        [--days N] [--threshold PP]
 *                                        [--min-games N]
 */

import { execFileSync } from 'node:child_process'

const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? (process.argv[i + 1] ?? 'production') : 'production'
})()
const DAYS = (() => {
  const i = process.argv.indexOf('--days')
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? '7', 10) : 7
})()
const THRESHOLD_PP = (() => {
  const i = process.argv.indexOf('--threshold')
  return i >= 0 ? Number.parseFloat(process.argv[i + 1] ?? '5') : 5
})()
const MIN_GAMES = (() => {
  const i = process.argv.indexOf('--min-games')
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? '50', 10) : 50
})()

const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

interface TriggerRow {
  guess_trigger: string | null
  games: number
  wins: number
}

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      DB_NAME,
      '--env',
      ENV_FLAG,
      '--remote',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function loadReal(): Map<string, { games: number; wins: number }> {
  const cutoff = Date.now() - DAYS * 86400 * 1000
  const sql = `SELECT COALESCE(guess_trigger, 'unknown') AS guess_trigger, COUNT(*) AS games, SUM(CASE WHEN won=1 THEN 1 ELSE 0 END) AS wins FROM game_stats WHERE created_at > ${cutoff} GROUP BY guess_trigger`
  const rows = d1<TriggerRow>(sql)
  const out = new Map<string, { games: number; wins: number }>()
  for (const r of rows) {
    out.set(r.guess_trigger ?? 'unknown', { games: r.games, wins: r.wins })
  }
  return out
}

function loadSim(): Map<string, { games: number; wins: number }> {
  // Latest sim run only — simulator is reseeded each batch.
  const sql = `WITH latest AS (SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1) SELECT COALESCE(s.guess_trigger, 'unknown') AS guess_trigger, COUNT(*) AS games, SUM(CASE WHEN s.won=1 THEN 1 ELSE 0 END) AS wins FROM sim_game_stats s JOIN latest l ON s.run_id = l.run_id GROUP BY s.guess_trigger`
  const rows = d1<TriggerRow>(sql)
  const out = new Map<string, { games: number; wins: number }>()
  for (const r of rows) {
    out.set(r.guess_trigger ?? 'unknown', { games: r.games, wins: r.wins })
  }
  return out
}

interface Comparison {
  trigger: string
  realGames: number
  realWinPct: number | null
  simGames: number
  simWinPct: number | null
  deltaPp: number | null
  status: 'ok' | 'fail' | 'insufficient'
}

function compare(
  real: Map<string, { games: number; wins: number }>,
  sim: Map<string, { games: number; wins: number }>
): Comparison[] {
  const triggers = new Set<string>([...real.keys(), ...sim.keys()])
  const results: Comparison[] = []
  for (const trigger of [...triggers].sort()) {
    const r = real.get(trigger) ?? { games: 0, wins: 0 }
    const s = sim.get(trigger) ?? { games: 0, wins: 0 }
    const realPct = r.games > 0 ? (100 * r.wins) / r.games : null
    const simPct = s.games > 0 ? (100 * s.wins) / s.games : null
    const delta = realPct !== null && simPct !== null ? realPct - simPct : null

    let status: Comparison['status']
    if (r.games < MIN_GAMES || s.games < MIN_GAMES) {
      status = 'insufficient'
    } else if (delta !== null && Math.abs(delta) > THRESHOLD_PP) {
      status = 'fail'
    } else {
      status = 'ok'
    }

    results.push({
      trigger,
      realGames: r.games,
      realWinPct: realPct,
      simGames: s.games,
      simWinPct: simPct,
      deltaPp: delta,
      status,
    })
  }
  return results
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)}%`
}

function fmtDelta(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)} pp`
}

function symbol(status: Comparison['status']): string {
  if (status === 'ok') return '✓'
  if (status === 'fail') return '✗'
  return '·'
}

function main(): void {
  console.log(
    `Calibration check — env=${ENV_FLAG} window=${DAYS}d threshold=±${THRESHOLD_PP}pp min-games=${MIN_GAMES}`
  )
  console.log('─'.repeat(78))

  const real = loadReal()
  const sim = loadSim()
  const results = compare(real, sim)

  if (results.length === 0) {
    console.log('No data found in either game_stats or sim_game_stats.')
    process.exit(1)
  }

  console.log(
    'trigger'.padEnd(22) +
      'real'.padStart(14) +
      'sim'.padStart(14) +
      'Δ'.padStart(12) +
      '  status'
  )
  console.log('─'.repeat(78))

  let failures = 0
  let insufficient = 0
  for (const r of results) {
    const realCol = `${fmtPct(r.realWinPct)} (n=${r.realGames})`
    const simCol = `${fmtPct(r.simWinPct)} (n=${r.simGames})`
    console.log(
      r.trigger.padEnd(22) +
        realCol.padStart(14) +
        simCol.padStart(14) +
        fmtDelta(r.deltaPp).padStart(12) +
        `  ${symbol(r.status)} ${r.status}`
    )
    if (r.status === 'fail') failures++
    if (r.status === 'insufficient') insufficient++
  }

  console.log('─'.repeat(78))
  console.log(
    `Summary: ${results.length - failures - insufficient} ok, ${failures} fail, ${insufficient} insufficient data`
  )

  if (failures > 0) {
    console.error(
      `\n✗  ${failures} trigger(s) drift > ${THRESHOLD_PP}pp from simulator. Investigate scoring/selection or refresh sim baseline.`
    )
    process.exit(1)
  }

  if (insufficient === results.length) {
    console.warn(
      `\n·  All triggers below min-games=${MIN_GAMES}. Re-run after the experiment accumulates more data.`
    )
    process.exit(0)
  }

  console.log('\n✓  Calibration within tolerance.')
}

main()
