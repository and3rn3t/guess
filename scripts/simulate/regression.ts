#!/usr/bin/env -S npx tsx
/**
 * Engine regression gate.
 *
 * Runs a fixed-sample simulation and compares results against a committed
 * baseline file.  Exits non-zero if quality drops beyond the configured thresholds.
 *
 * Usage (local):
 *   pnpm simulate:regression
 *   pnpm simulate:regression --update-baseline   # write new baseline
 *
 * Usage (CI):  called automatically by .github/workflows/engine-regression.yml
 *
 * Thresholds (hard failures):
 *   Win-rate drop   > WIN_RATE_TOLERANCE  (default: 2 pp)
 *   Avg-Q increase  > AVG_Q_TOLERANCE     (default: 0.5 questions)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simulateGame, DIFFICULTY_MAP } from './engine.js'
import type { SimCharacter, SimQuestion, SimGameResult } from './engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const BASELINE_PATH = join(__dirname, 'baseline.jsonl')

// ── Thresholds ────────────────────────────────────────────────────────────────
const WIN_RATE_TOLERANCE = 2.0   // percentage points
const AVG_Q_TOLERANCE    = 0.5   // questions

// ── Sample config ─────────────────────────────────────────────────────────────
/** Fixed seed-based deterministic sample size for fast CI runs. */
const SAMPLE_SIZE = 150
const DIFFICULTY: keyof typeof DIFFICULTY_MAP = 'medium'

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(vals: number[]): number {
  return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length
}

interface Metrics { winRate: number; avgQuestions: number; n: number }

function extractMetrics(results: SimGameResult[]): Metrics {
  return {
    winRate: (results.filter((r) => r.won).length / results.length) * 100,
    avgQuestions: avg(results.map((r) => r.questionsAsked)),
    n: results.length,
  }
}

function loadResults(path: string): SimGameResult[] {
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
  return lines.map((l) => JSON.parse(l) as SimGameResult)
}

function writeResults(path: string, results: SimGameResult[]): void {
  writeFileSync(path, results.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

/** Seeded shuffle — same order every CI run so sample is stable. */
function seededSample<T>(arr: T[], n: number, seed = 42): T[] {
  // Mulberry32 PRNG
  let s = seed
  const rand = () => {
    s |= 0; s = s + 0x6d2b79f5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, n)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const updateBaseline = process.argv.includes('--update-baseline')

  const charsPath = join(DATA_DIR, 'characters.json')
  const questionsPath = join(DATA_DIR, 'questions.json')

  if (!existsSync(charsPath) || !existsSync(questionsPath)) {
    console.error(
      '✗  Simulation data not found.\n' +
      '   Run `pnpm simulate:export` first to generate characters.json and questions.json.'
    )
    process.exit(1)
  }

  const allChars = JSON.parse(readFileSync(charsPath, 'utf8')) as SimCharacter[]
  const questions = JSON.parse(readFileSync(questionsPath, 'utf8')) as SimQuestion[]

  if (allChars.length < SAMPLE_SIZE) {
    console.error(`✗  Not enough characters (${allChars.length} < ${SAMPLE_SIZE})`)
    process.exit(1)
  }

  const sample = seededSample(allChars, SAMPLE_SIZE)
  const runId = `regression-${Date.now()}`
  const options = { difficulty: DIFFICULTY as keyof typeof DIFFICULTY_MAP }

  console.log(`Running ${SAMPLE_SIZE} simulations (difficulty: ${DIFFICULTY}) …`)

  const results: SimGameResult[] = sample.map((target) =>
    simulateGame(target, allChars, questions, runId, options)
  )

  const current = extractMetrics(results)
  console.log(`  Win rate: ${current.winRate.toFixed(1)}%  Avg Q: ${current.avgQuestions.toFixed(2)}  (n=${current.n})`)

  if (updateBaseline) {
    if (!existsSync(dirname(BASELINE_PATH))) mkdirSync(dirname(BASELINE_PATH), { recursive: true })
    writeResults(BASELINE_PATH, results)
    console.log(`\n✓  Baseline updated → ${BASELINE_PATH}`)
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      '✗  No baseline found.\n' +
      '   Run `pnpm simulate:regression --update-baseline` to create one, then commit it.'
    )
    process.exit(1)
  }

  const baselineResults = loadResults(BASELINE_PATH)
  const baseline = extractMetrics(baselineResults)
  console.log(`  Baseline: ${baseline.winRate.toFixed(1)}%  Avg Q: ${baseline.avgQuestions.toFixed(2)}  (n=${baseline.n})`)

  const winDelta = current.winRate - baseline.winRate
  const avgQDelta = current.avgQuestions - baseline.avgQuestions

  console.log()
  console.log('─'.repeat(60))
  const winSign = winDelta >= 0 ? '+' : ''
  const qSign   = avgQDelta >= 0 ? '+' : ''
  console.log(`  Win rate Δ:  ${winSign}${winDelta.toFixed(2)} pp  (threshold: −${WIN_RATE_TOLERANCE} pp)`)
  console.log(`  Avg Q    Δ:  ${qSign}${avgQDelta.toFixed(3)}     (threshold: +${AVG_Q_TOLERANCE})`)
  console.log('─'.repeat(60))

  const failures: string[] = []

  if (winDelta < -WIN_RATE_TOLERANCE) {
    failures.push(
      `Win rate dropped ${Math.abs(winDelta).toFixed(2)} pp ` +
      `(${baseline.winRate.toFixed(1)}% → ${current.winRate.toFixed(1)}%) — ` +
      `threshold: −${WIN_RATE_TOLERANCE} pp`
    )
  }

  if (avgQDelta > AVG_Q_TOLERANCE) {
    failures.push(
      `Avg questions increased ${avgQDelta.toFixed(3)} ` +
      `(${baseline.avgQuestions.toFixed(2)} → ${current.avgQuestions.toFixed(2)}) — ` +
      `threshold: +${AVG_Q_TOLERANCE}`
    )
  }

  if (failures.length > 0) {
    console.log()
    for (const f of failures) {
      console.error(`✗  ${f}`)
    }
    console.log()
    console.error('Engine regression detected. If intentional, update the baseline:')
    console.error('  pnpm simulate:regression --update-baseline')
    process.exit(1)
  }

  console.log()
  console.log('✓  No regression detected.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
