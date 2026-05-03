#!/usr/bin/env npx tsx
/**
 * Phase 3: Question Expansion Validation Harness
 *
 * Uses real game_stats data to compare control vs experiment cohorts.
 * This validates whether question expansion reduces turns in production.
 *
 * Gate:
 *   PASS               >= 5% avg-turn reduction
 *   MARGINAL           >= 2% and < 5%
 *   FAIL               < 2% or negative
 *   INSUFFICIENT_DATA  either cohort below min sample size
 *
 * Usage:
 *   npx tsx scripts/simulate-question-expansion.ts --sample-size 500 --env production --remote
 *   npx tsx scripts/simulate-question-expansion.ts --before-variant control --after-variant experiment --min-samples 100
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface GameStatsRow {
  questions_asked: number
  won: number
  difficulty: string
  variant: string
  selector: string
  created_at: number
}

interface CohortStats {
  avgTurns: number
  medianTurns: number
  p95Turns: number
  successRate: number
  totalGames: number
  byDifficulty: Record<string, number>
}

type ImprovementStatus = 'PASS' | 'MARGINAL' | 'FAIL' | 'INSUFFICIENT_DATA'

interface SimulationResult {
  timestamp: string
  config: {
    sampleSize: number
    minSamples: number
    beforeVariant: string
    afterVariant: string
    environment: string
    mode: string
  }
  before: CohortStats
  after: CohortStats
  delta: {
    turns_percent: number
    turns_absolute: number
    success_rate_points: number
    improvement: ImprovementStatus
  }
  recommendations: string[]
}

const SAMPLE_SIZE = (() => {
  const i = process.argv.indexOf('--sample-size')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 300 : 300
})()

const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()

const BEFORE_VARIANT = (() => {
  const i = process.argv.indexOf('--before-variant')
  return i >= 0 ? process.argv[i + 1] : 'control'
})()

const AFTER_VARIANT = (() => {
  const i = process.argv.indexOf('--after-variant')
  return i >= 0 ? process.argv[i + 1] : 'experiment'
})()

const MIN_SAMPLES = (() => {
  const i = process.argv.indexOf('--min-samples')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 100 : 100
})()

const IS_REMOTE = process.argv.includes('--remote')
const OUT_FILE = (() => {
  const i = process.argv.indexOf('--output')
  return i >= 0 ? process.argv[i + 1] : `data/sim-report-${new Date().toISOString().split('T')[0]}.json`
})()

const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

function d1Query(sql: string): Array<Record<string, unknown>> {
  try {
    const out = execFileSync(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        DB_NAME,
        '--env',
        ENV_FLAG,
        IS_REMOTE ? '--remote' : '--local',
        '--json',
        '--command',
        sql,
      ],
      { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }
    )
    return JSON.parse(out).results || []
  } catch (e) {
    console.error(`D1 query failed: ${e}`)
    process.exit(1)
  }
}

function computeStats(values: number[]): { avg: number; median: number; p95: number } {
  if (values.length === 0) return { avg: 0, median: 0, p95: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]

  return { avg, median, p95 }
}

function summarizeCohort(rows: GameStatsRow[]): CohortStats {
  const turns = rows.map((r) => r.questions_asked)
  const wins = rows.filter((r) => r.won === 1).length
  const stats = computeStats(turns)

  const difficultyCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.difficulty || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byDifficulty = Object.fromEntries(
    Object.entries(difficultyCounts).map(([k, v]) => [
      k,
      Number(((v / Math.max(1, rows.length)) * 100).toFixed(1)),
    ])
  )

  return {
    avgTurns: stats.avg,
    medianTurns: stats.median,
    p95Turns: stats.p95,
    successRate: rows.length > 0 ? (wins * 100) / rows.length : 0,
    totalGames: rows.length,
    byDifficulty,
  }
}

function buildRecommendations(
  status: ImprovementStatus,
  turnsPercent: number,
  before: CohortStats,
  after: CohortStats
): string[] {
  const recommendations: string[] = []

  if (status === 'INSUFFICIENT_DATA') {
    recommendations.push(
      `INSUFFICIENT_DATA: need >= ${MIN_SAMPLES} samples in each cohort to validate rollout gate.`
    )
    recommendations.push(
      `Current samples -> ${BEFORE_VARIANT}: ${before.totalGames}, ${AFTER_VARIANT}: ${after.totalGames}.`
    )
    recommendations.push('Continue collection and rerun this script.')
    return recommendations
  }

  if (status === 'PASS') {
    recommendations.push(`PASS: ${turnsPercent.toFixed(1)}% turn reduction exceeds 5% gate.`)
    recommendations.push('Proceed to Phase 4 rollout: 10% -> 50% -> 100%.')
    return recommendations
  }

  if (status === 'MARGINAL') {
    recommendations.push(
      `MARGINAL: ${turnsPercent.toFixed(1)}% turn reduction is positive but below 5% gate.`
    )
    recommendations.push('Tune question generation and rerun validation before full rollout.')
    return recommendations
  }

  recommendations.push(`FAIL: ${turnsPercent.toFixed(1)}% change does not meet acceptance gate.`)
  recommendations.push('Revisit attribute gap selection and metadata quality before rollout expansion.')
  return recommendations
}

function main() {
  console.log('[simulate-expansion] Phase 3: Question Expansion Validation')
  console.log(`  Sample size per cohort: ${SAMPLE_SIZE}`)
  console.log(`  Cohorts: ${BEFORE_VARIANT} (before) vs ${AFTER_VARIANT} (after)`)
  console.log(`  Min samples required: ${MIN_SAMPLES}`)
  console.log(`  Environment: ${ENV_FLAG}`)
  console.log(`  Mode: ${IS_REMOTE ? 'remote' : 'local'}`)
  console.log()

  console.log('[1/3] Loading game_stats rows...')
  const rows = d1Query(
    `
      SELECT
        questions_asked,
        won,
        difficulty,
        COALESCE(variant, 'control') as variant,
        COALESCE(selector, 'mcts') as selector,
        created_at
      FROM game_stats
      WHERE questions_asked > 0
      ORDER BY created_at DESC
      LIMIT ${Math.max(2000, SAMPLE_SIZE * 6)}
    `
  ) as unknown as GameStatsRow[]
  console.log(`     Loaded ${rows.length} rows`)

  console.log()
  console.log('[2/3] Building before/after cohorts...')
  const beforeRows = rows.filter((r) => r.variant === BEFORE_VARIANT).slice(0, SAMPLE_SIZE)
  const afterRows = rows.filter((r) => r.variant === AFTER_VARIANT).slice(0, SAMPLE_SIZE)
  console.log(`     ${BEFORE_VARIANT}: ${beforeRows.length}`)
  console.log(`     ${AFTER_VARIANT}: ${afterRows.length}`)

  const before = summarizeCohort(beforeRows)
  const after = summarizeCohort(afterRows)

  console.log()
  console.log('[3/3] Computing deltas + gate...')
  const turnsDelta = before.avgTurns - after.avgTurns
  const turnsPercent = before.avgTurns > 0 ? (turnsDelta / before.avgTurns) * 100 : 0
  const successDelta = after.successRate - before.successRate

  let improvement: ImprovementStatus = 'FAIL'
  if (before.totalGames < MIN_SAMPLES || after.totalGames < MIN_SAMPLES) {
    improvement = 'INSUFFICIENT_DATA'
  } else if (turnsPercent >= 5) {
    improvement = 'PASS'
  } else if (turnsPercent >= 2) {
    improvement = 'MARGINAL'
  }

  const result: SimulationResult = {
    timestamp: new Date().toISOString(),
    config: {
      sampleSize: SAMPLE_SIZE,
      minSamples: MIN_SAMPLES,
      beforeVariant: BEFORE_VARIANT,
      afterVariant: AFTER_VARIANT,
      environment: ENV_FLAG,
      mode: IS_REMOTE ? 'remote' : 'local',
    },
    before,
    after,
    delta: {
      turns_percent: turnsPercent,
      turns_absolute: turnsDelta,
      success_rate_points: successDelta,
      improvement,
    },
    recommendations: buildRecommendations(improvement, turnsPercent, before, after),
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2))

  console.log()
  console.log(`Report saved: ${OUT_FILE}`)
  console.log()
  console.log('Summary:')
  console.log(
    `  Before (${BEFORE_VARIANT}): avg=${before.avgTurns.toFixed(2)} turns, win=${before.successRate.toFixed(1)}% (n=${before.totalGames})`
  )
  console.log(
    `  After  (${AFTER_VARIANT}): avg=${after.avgTurns.toFixed(2)} turns, win=${after.successRate.toFixed(1)}% (n=${after.totalGames})`
  )
  console.log(
    `  Turns delta: ${turnsDelta >= 0 ? '+' : ''}${turnsDelta.toFixed(2)} (${turnsPercent >= 0 ? '+' : ''}${turnsPercent.toFixed(1)}%)`
  )
  console.log(`  Win-rate delta: ${successDelta >= 0 ? '+' : ''}${successDelta.toFixed(2)} pp`)
  console.log(`  Gate: ${improvement}`)
  console.log()

  for (const rec of result.recommendations) {
    console.log(`  - ${rec}`)
  }
}

main()
