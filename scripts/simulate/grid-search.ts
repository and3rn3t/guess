/**
 * Grid search over Bayesian scoring weights (S.8).
 *
 * Tests combinations of SCORE_MATCH, SCORE_MISMATCH, SCORE_MAYBE, SCORE_MAYBE_MISS
 * across a configurable number of simulated games and identifies the Pareto front
 * (maximize win rate AND minimize avg questions — both objectives matter).
 *
 * Usage:
 *   pnpm simulate:grid                          # 100 games, default pool
 *   pnpm simulate:grid --games 200              # more games per grid point
 *   pnpm simulate:grid --sample 50 --games 50   # quick sweep
 *   pnpm simulate:grid --difficulty hard
 *   pnpm simulate:grid --output grid.jsonl      # write JSONL results
 *
 * Requires:
 *   scripts/simulate/data/characters.json   (pnpm simulate:export)
 *   scripts/simulate/data/questions.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simulateGame, DIFFICULTY_MAP } from './engine.js'
import type { SimCharacter, SimQuestion } from './engine.js'
import type { ScoringWeights } from '@guess/game-engine'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')

// ── CLI args ──────────────────────────────────────────────────────────────────

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null
}

const GAMES_PER_POINT = arg('games') ? parseInt(arg('games')!, 10) : 100
const SAMPLE = arg('sample') ? parseInt(arg('sample')!, 10) : null
const DIFFICULTY = arg('difficulty') ?? 'medium'
const OUTPUT_FILE = arg('output')
const NOISE = arg('noise') ? parseFloat(arg('noise')!) / 100 : 0
const POOL_SIZE = arg('pool-size') ? parseInt(arg('pool-size')!, 10) : undefined
const VERBOSE = flag('verbose')

if (!DIFFICULTY_MAP[DIFFICULTY]) {
  console.error(`Unknown difficulty "${DIFFICULTY}". Choose easy, medium, or hard.`)
  process.exit(1)
}

// ── Load data ─────────────────────────────────────────────────────────────────

const characterPath = join(DATA_DIR, 'characters.json')
const questionPath = join(DATA_DIR, 'questions.json')

if (!existsSync(characterPath) || !existsSync(questionPath)) {
  console.error('Data files not found. Run `pnpm simulate:export` first.')
  process.exit(1)
}

const allCharacters: SimCharacter[] = JSON.parse(readFileSync(characterPath, 'utf8'))
const questions: SimQuestion[] = JSON.parse(readFileSync(questionPath, 'utf8'))

if (allCharacters.length === 0 || questions.length === 0) {
  console.error('Empty character or question data. Re-run `pnpm simulate:export`.')
  process.exit(1)
}

// ── Parameter grid ────────────────────────────────────────────────────────────
// Sensible ranges derived from production constants:
//   SCORE_MATCH=1.0, SCORE_MISMATCH=0.03, SCORE_MAYBE=0.7, SCORE_MAYBE_MISS=0.3

const MATCH_VALUES    = [0.8, 1.0, 1.2]
const MISMATCH_VALUES = [0.01, 0.03, 0.05]
const MAYBE_VALUES    = [0.5, 0.6, 0.7, 0.8]
const MAYBE_MISS_VALUES = [0.2, 0.3, 0.4]

// Filter out combinations where maybeMiss >= maybe (must stay a "partial match")
const gridPoints: ScoringWeights[] = []
for (const match of MATCH_VALUES) {
  for (const mismatch of MISMATCH_VALUES) {
    for (const maybe of MAYBE_VALUES) {
      for (const maybeMiss of MAYBE_MISS_VALUES) {
        if (maybeMiss < maybe) {
          gridPoints.push({ match, mismatch, maybe, maybeMiss })
        }
      }
    }
  }
}

// ── Select character sample ───────────────────────────────────────────────────

let pool: SimCharacter[]
if (SAMPLE) {
  pool = allCharacters.slice().sort(() => Math.random() - 0.5).slice(0, SAMPLE)
} else {
  pool = allCharacters
}

const fullPool = POOL_SIZE ? allCharacters.slice(0, POOL_SIZE) : allCharacters

const totalRuns = gridPoints.length * Math.min(pool.length, GAMES_PER_POINT)
console.log(`\nGrid search: ${gridPoints.length} parameter combinations × up to ${GAMES_PER_POINT} games each`)
console.log(`Characters: ${pool.length} targets | Full pool: ${fullPool.length} | Difficulty: ${DIFFICULTY}`)
console.log(`Total simulations: ~${totalRuns.toLocaleString()}\n`)

// ── Run grid ──────────────────────────────────────────────────────────────────

interface GridResult {
  weights: ScoringWeights
  winRate: number
  avgQuestions: number
  wins: number
  total: number
  pareto: boolean
}

const gridResults: GridResult[] = []

for (let pi = 0; pi < gridPoints.length; pi++) {
  const weights = gridPoints[pi]!

  // Sample up to GAMES_PER_POINT targets (re-sample each grid point for diversity)
  const targets = pool.length <= GAMES_PER_POINT
    ? pool
    : pool.slice().sort(() => Math.random() - 0.5).slice(0, GAMES_PER_POINT)

  const runId = crypto.randomUUID()
  let wins = 0
  let totalQ = 0

  for (const target of targets) {
    const r = simulateGame(target, fullPool, questions, runId, {
      difficulty: DIFFICULTY,
      poolSize: POOL_SIZE,
      noise: NOISE,
      scoringWeights: weights,
    })
    if (r.won) wins++
    totalQ += r.questionsAsked
  }

  const winRate = wins / targets.length
  const avgQuestions = totalQ / targets.length

  gridResults.push({ weights, winRate, avgQuestions, wins, total: targets.length, pareto: false })

  if (VERBOSE || pi % 10 === 0) {
    process.stdout.write(
      `  [${String(pi + 1).padStart(3)}/${gridPoints.length}] ` +
      `match=${weights.match} mm=${weights.mismatch} maybe=${weights.maybe} mm2=${weights.maybeMiss}` +
      ` → win=${(winRate * 100).toFixed(1)}% avgQ=${avgQuestions.toFixed(1)}\n`
    )
  }
}

// ── Pareto front ──────────────────────────────────────────────────────────────
// A point is Pareto-optimal if no other point has both higher winRate AND lower avgQ.

for (const point of gridResults) {
  const dominated = gridResults.some(
    (other) =>
      other !== point &&
      other.winRate >= point.winRate &&
      other.avgQuestions <= point.avgQuestions &&
      (other.winRate > point.winRate || other.avgQuestions < point.avgQuestions)
  )
  point.pareto = !dominated
}

const paretoFront = gridResults.filter((r) => r.pareto)
const sortedAll = gridResults.slice().sort((a, b) => b.winRate - a.winRate || a.avgQuestions - b.avgQuestions)

// ── Results ───────────────────────────────────────────────────────────────────

console.log('\n── Pareto Front (Maximize Win Rate + Minimize Avg Questions) ───────────────────')
console.log(
  `  ${'Match'.padStart(5)} ${'Msmt'.padStart(5)} ${'Maybe'.padStart(5)} ${'MM2'.padStart(5)}` +
  `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)} ${'Wins'.padStart(5)}`
)
console.log('  ' + '─'.repeat(52))

for (const r of paretoFront.sort((a, b) => b.winRate - a.winRate || a.avgQuestions - b.avgQuestions)) {
  console.log(
    `  ${String(r.weights.match).padStart(5)} ${String(r.weights.mismatch).padStart(5)} ` +
    `${String(r.weights.maybe).padStart(5)} ${String(r.weights.maybeMiss).padStart(5)}` +
    `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)} ` +
    `${String(r.wins).padStart(4)}/${r.total}`
  )
}

console.log('\n── Top 10 by Win Rate ───────────────────────────────────────────────────────────')
console.log(
  `  ${'Match'.padStart(5)} ${'Msmt'.padStart(5)} ${'Maybe'.padStart(5)} ${'MM2'.padStart(5)}` +
  `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)} ${'Pareto'}`
)
console.log('  ' + '─'.repeat(56))
for (const r of sortedAll.slice(0, 10)) {
  console.log(
    `  ${String(r.weights.match).padStart(5)} ${String(r.weights.mismatch).padStart(5)} ` +
    `${String(r.weights.maybe).padStart(5)} ${String(r.weights.maybeMiss).padStart(5)}` +
    `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)}  ${r.pareto ? '★' : ' '}`
  )
}

console.log('\n── Bottom 10 by Win Rate ────────────────────────────────────────────────────────')
console.log(
  `  ${'Match'.padStart(5)} ${'Msmt'.padStart(5)} ${'Maybe'.padStart(5)} ${'MM2'.padStart(5)}` +
  `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)}`
)
console.log('  ' + '─'.repeat(50))
for (const r of sortedAll.slice(-10).reverse()) {
  console.log(
    `  ${String(r.weights.match).padStart(5)} ${String(r.weights.mismatch).padStart(5)} ` +
    `${String(r.weights.maybe).padStart(5)} ${String(r.weights.maybeMiss).padStart(5)}` +
    `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)}`
  )
}

// ── Production baseline ───────────────────────────────────────────────────────
// Identify where the current production constants rank

const prod = gridResults.find(
  (r) => r.weights.match === 1.0 && r.weights.mismatch === 0.03 &&
         r.weights.maybe === 0.7 && r.weights.maybeMiss === 0.3
)
if (prod) {
  const rank = sortedAll.indexOf(prod) + 1
  console.log(
    `\n── Production baseline (match=1.0 mm=0.03 maybe=0.7 mm2=0.3): ` +
    `rank #${rank}/${gridPoints.length} | win=${(prod.winRate * 100).toFixed(1)}% avgQ=${prod.avgQuestions.toFixed(1)}${prod.pareto ? ' ★ Pareto' : ''}`
  )
}

// ── JSONL output ──────────────────────────────────────────────────────────────

if (OUTPUT_FILE) {
  const outDir = join(DATA_DIR)
  mkdirSync(outDir, { recursive: true })
  const outPath = OUTPUT_FILE.startsWith('/') ? OUTPUT_FILE : join(DATA_DIR, OUTPUT_FILE)
  const lines = sortedAll.map((r) => JSON.stringify(r)).join('\n') + '\n'
  writeFileSync(outPath, lines, 'utf8')
  console.log(`\nGrid results written to ${outPath}`)
} else {
  const defaultOut = join(DATA_DIR, 'grid-search-results.jsonl')
  const lines = sortedAll.map((r) => JSON.stringify(r)).join('\n') + '\n'
  writeFileSync(defaultOut, lines, 'utf8')
  console.log(`\nGrid results written to ${defaultOut}`)
}
