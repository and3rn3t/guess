#!/usr/bin/env npx tsx
/**
 * Promotion gate for A/B-tested scoring weights.
 *
 * Runs once per week. Decides whether the current experiment arm has earned
 * promotion to `kv:engine:weights-active`.
 *
 * Promotion criteria (ALL must hold):
 *   - ≥500 games per arm in the trailing window
 *   - experiment win-rate ≥ control win-rate + 1σ (computed from the pooled
 *     standard error of the two-proportion difference)
 *   - experiment avg questions ≤ control avg questions + 0.5
 *
 * On promotion: writes data/promotion/weights-active.json (the workflow
 * uploads it to KV) and outputs `action=promote` to summary.json.
 *
 * On rejection: outputs `action=hold` and (optionally) `action=rollback`
 * if the experiment is materially worse (≥1σ in the wrong direction).
 *
 * Usage:
 *   npx tsx scripts/promote-experiment.ts [--env preview|production] [--days N]
 */

import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()
const DAYS = (() => {
  const i = process.argv.indexOf('--days')
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? '7', 10) : 7
})()
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

const OUT_DIR = path.join('data', 'promotion')
fs.mkdirSync(OUT_DIR, { recursive: true })

const MIN_GAMES_PER_ARM = 500

interface ArmRow {
  variant: string | null
  games: number
  wins: number
  avg_q: number | null
}

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

/** Pooled standard error of the difference in two proportions. */
function pooledSE(wA: number, nA: number, wB: number, nB: number): number {
  if (nA <= 0 || nB <= 0) return 0
  const pPool = (wA + wB) / (nA + nB)
  return Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB))
}

async function main(): Promise<void> {
  console.log(`[promote] env=${ENV_FLAG} days=${DAYS}`)

  const cutoff = Date.now() - DAYS * 86400 * 1000
  const arms = d1<ArmRow>(
    `SELECT
       COALESCE(variant, 'unassigned') AS variant,
       COUNT(*) AS games,
       SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) AS wins,
       AVG(questions_asked) AS avg_q
     FROM game_stats
     WHERE created_at > ${cutoff}
     GROUP BY variant`
  )

  const control = arms.find((a) => a.variant === 'control')
  const experiment = arms.find((a) => a.variant === 'experiment')

  const summary: Record<string, unknown> = {
    env: ENV_FLAG,
    days: DAYS,
    arms,
    control,
    experiment,
  }

  if (!control || !experiment) {
    summary.action = 'skip'
    summary.reason = 'missing_arm'
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log('[promote] missing control or experiment arm — skip')
    return
  }

  if (control.games < MIN_GAMES_PER_ARM || experiment.games < MIN_GAMES_PER_ARM) {
    summary.action = 'skip'
    summary.reason = 'insufficient_games'
    summary.minPerArm = MIN_GAMES_PER_ARM
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log(`[promote] insufficient games (control=${control.games} exp=${experiment.games}, need ${MIN_GAMES_PER_ARM} each) — skip`)
    return
  }

  const pCtrl = control.wins / control.games
  const pExp = experiment.wins / experiment.games
  const delta = pExp - pCtrl
  const se = pooledSE(experiment.wins, experiment.games, control.wins, control.games)
  const zSigmas = se > 0 ? delta / se : 0
  const qDelta = (experiment.avg_q ?? 0) - (control.avg_q ?? 0)

  summary.controlWinRate = pCtrl
  summary.experimentWinRate = pExp
  summary.deltaWinRate = delta
  summary.zSigmas = zSigmas
  summary.questionsDelta = qDelta

  const candidateRaw = d1<{value: string}>(`SELECT value FROM engine_config WHERE key = 'ab:experiment-weights' LIMIT 1`)[0]?.value ?? null
  if (!candidateRaw) {
    summary.action = 'skip'
    summary.reason = 'no_candidate_weights'
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log('[promote] engine_config ab:experiment-weights is empty — nothing to promote')
    return
  }

  // Promote when experiment is at least 1σ better and not materially slower.
  if (zSigmas >= 1 && qDelta <= 0.5) {
    fs.writeFileSync(path.join(OUT_DIR, 'weights-active.json'), candidateRaw)
    summary.action = 'promote'
    summary.reason = 'gain_above_one_sigma'
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log(`[promote] PROMOTE — Δ=${(delta * 100).toFixed(2)}% (${zSigmas.toFixed(2)}σ), ΔQ=${qDelta.toFixed(2)}`)
    return
  }

  if (zSigmas <= -1) {
    summary.action = 'rollback'
    summary.reason = 'regression_below_neg_one_sigma'
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log(`[promote] ROLLBACK — Δ=${(delta * 100).toFixed(2)}% (${zSigmas.toFixed(2)}σ)`)
    return
  }

  summary.action = 'hold'
  summary.reason = 'inconclusive'
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(`[promote] HOLD — Δ=${(delta * 100).toFixed(2)}% (${zSigmas.toFixed(2)}σ)`)
}

void main().catch((err) => {
  console.error('[promote] fatal:', err)
  process.exit(1)
})
