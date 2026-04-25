/**
 * Grid search over Bayesian scoring weights (Phase 1) and structural question-selection
 * constants (Phase 2).
 *
 * Phase 1 tests combinations of SCORE_MATCH, SCORE_MISMATCH, SCORE_MAYBE, SCORE_MAYBE_MISS.
 * Phase 2 tests combinations of diversityGroupPenalty, diversityCategoryPenalty,
 *   taxonomySpeciesBoost, taxonomyOriginBoost, and endgameFocusThreshold.
 *
 * Results are ranked by Pareto optimality (maximize win rate AND minimize avg questions).
 *
 * Usage:
 *   pnpm simulate:grid                          # Phase 1 only, 100 games, default pool
 *   pnpm simulate:grid --phase 2                # Phase 2 structural constants
 *   pnpm simulate:grid --phase all              # Run both phases
 *   pnpm simulate:grid --games 200              # more games per grid point
 *   pnpm simulate:grid --sample 50 --games 50   # quick sweep
 *   pnpm simulate:grid --difficulty hard
 *   pnpm simulate:grid --output combined.jsonl  # write combined JSONL results
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
import type { ScoringWeights, StructuralWeights } from '@guess/game-engine'

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
/**
 * Which phase to run:
 *   1  = Bayesian scoring weights  (match / mismatch / maybe / maybeMiss)
 *   2  = Structural constants      (diversity penalties, taxonomy boosts, endgame threshold)
 *   all = Both phases sequentially
 * Default: 1
 */
const PHASE = arg('phase') ?? '1'

if (!DIFFICULTY_MAP[DIFFICULTY]) {
  console.error(`Unknown difficulty "${DIFFICULTY}". Choose easy, medium, or hard.`)
  process.exit(1)
}

if (!['1', '2', 'all'].includes(PHASE)) {
  console.error(`Unknown phase "${PHASE}". Choose 1, 2, or all.`)
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

// ── Phase 1: Bayesian scoring weight grid ─────────────────────────────────────
// Sensible ranges derived from production constants:
//   SCORE_MATCH=1.0, SCORE_MISMATCH=0.03, SCORE_MAYBE=0.7, SCORE_MAYBE_MISS=0.3

const MATCH_VALUES    = [0.8, 1.0, 1.2]
const MISMATCH_VALUES = [0.01, 0.03, 0.05]
const MAYBE_VALUES    = [0.5, 0.6, 0.7, 0.8]
const MAYBE_MISS_VALUES = [0.2, 0.3, 0.4]

// ── Phase 2: Structural constants grid ────────────────────────────────────────
// Sensible ranges derived from production defaults in question-selection.ts:
//   diversityGroupPenalty=0.75, diversityCategoryPenalty=0.8
//   taxonomySpeciesBoost=2.0,   taxonomyOriginBoost=1.3
//   endgameFocusThreshold=0.65

const DIVERSITY_GROUP_VALUES    = [0.6, 0.75, 0.9]
const DIVERSITY_CATEGORY_VALUES = [0.65, 0.8, 0.95]
const TAXONOMY_SPECIES_VALUES   = [1.5, 2.0, 2.5]
const TAXONOMY_ORIGIN_VALUES    = [1.0, 1.3, 1.6]
const ENDGAME_FOCUS_VALUES      = [0.55, 0.65, 0.75]

// Filter out combinations where maybeMiss >= maybe (must stay a "partial match")
const phase1GridPoints: ScoringWeights[] = []
if (PHASE === '1' || PHASE === 'all') {
  for (const match of MATCH_VALUES) {
    for (const mismatch of MISMATCH_VALUES) {
      for (const maybe of MAYBE_VALUES) {
        for (const maybeMiss of MAYBE_MISS_VALUES) {
          if (maybeMiss < maybe) {
            phase1GridPoints.push({ match, mismatch, maybe, maybeMiss })
          }
        }
      }
    }
  }
}

const phase2GridPoints: StructuralWeights[] = []
if (PHASE === '2' || PHASE === 'all') {
  for (const dgp of DIVERSITY_GROUP_VALUES) {
    for (const dcp of DIVERSITY_CATEGORY_VALUES) {
      for (const tsb of TAXONOMY_SPECIES_VALUES) {
        for (const tob of TAXONOMY_ORIGIN_VALUES) {
          for (const eft of ENDGAME_FOCUS_VALUES) {
            phase2GridPoints.push({
              diversityGroupPenalty: dgp,
              diversityCategoryPenalty: dcp,
              taxonomySpeciesBoost: tsb,
              taxonomyOriginBoost: tob,
              endgameFocusThreshold: eft,
            })
          }
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

const totalPhase1 = phase1GridPoints.length * Math.min(pool.length, GAMES_PER_POINT)
const totalPhase2 = phase2GridPoints.length * Math.min(pool.length, GAMES_PER_POINT)
const totalRuns = totalPhase1 + totalPhase2
console.log(`\nGrid search configuration:`)
console.log(`  Phases:      ${PHASE === 'all' ? '1 + 2' : `Phase ${PHASE}`}`)
if (phase1GridPoints.length > 0) console.log(`  Phase 1:     ${phase1GridPoints.length} scoring-weight combinations`)
if (phase2GridPoints.length > 0) console.log(`  Phase 2:     ${phase2GridPoints.length} structural-constant combinations`)
console.log(`  Characters:  ${pool.length} targets | Full pool: ${fullPool.length}`)
console.log(`  Difficulty:  ${DIFFICULTY} | Games/point: ${GAMES_PER_POINT}`)
console.log(`  Total sims:  ~${totalRuns.toLocaleString()}\n`)

// ── Shared types ──────────────────────────────────────────────────────────────

interface GridResult {
  weights: ScoringWeights
  winRate: number
  avgQuestions: number
  wins: number
  total: number
  pareto: boolean
}

interface StructuralGridResult {
  weights: StructuralWeights
  winRate: number
  avgQuestions: number
  wins: number
  total: number
  pareto: boolean
}

function markParetoFront<T extends { winRate: number; avgQuestions: number; pareto: boolean }>(
  results: T[],
): void {
  for (const point of results) {
    point.pareto = !results.some(
      (other) =>
        other !== point &&
        other.winRate >= point.winRate &&
        other.avgQuestions <= point.avgQuestions &&
        (other.winRate > point.winRate || other.avgQuestions < point.avgQuestions),
    )
  }
}

// ── Phase 1 run ───────────────────────────────────────────────────────────────

const gridResults: GridResult[] = []

if (phase1GridPoints.length > 0) {
  console.log(`── Phase 1: Bayesian Scoring Weights ────────────────────────────────────────────`)
  for (let pi = 0; pi < phase1GridPoints.length; pi++) {
    const weights = phase1GridPoints[pi]!

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
        `  [${String(pi + 1).padStart(3)}/${phase1GridPoints.length}] ` +
        `match=${weights.match} mm=${weights.mismatch} maybe=${weights.maybe} mm2=${weights.maybeMiss}` +
        ` → win=${(winRate * 100).toFixed(1)}% avgQ=${avgQuestions.toFixed(1)}\n`,
      )
    }
  }
}

// ── Phase 2 run ───────────────────────────────────────────────────────────────

const structuralResults: StructuralGridResult[] = []

if (phase2GridPoints.length > 0) {
  console.log(`\n── Phase 2: Structural Constants ────────────────────────────────────────────────`)
  for (let pi = 0; pi < phase2GridPoints.length; pi++) {
    const sw = phase2GridPoints[pi]!

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
        structuralWeights: sw,
      })
      if (r.won) wins++
      totalQ += r.questionsAsked
    }

    const winRate = wins / targets.length
    const avgQuestions = totalQ / targets.length

    structuralResults.push({ weights: sw, winRate, avgQuestions, wins, total: targets.length, pareto: false })

    if (VERBOSE || pi % 20 === 0) {
      process.stdout.write(
        `  [${String(pi + 1).padStart(4)}/${phase2GridPoints.length}] ` +
        `dgp=${sw.diversityGroupPenalty} dcp=${sw.diversityCategoryPenalty} ` +
        `tsb=${sw.taxonomySpeciesBoost} tob=${sw.taxonomyOriginBoost} eft=${sw.endgameFocusThreshold}` +
        ` → win=${(winRate * 100).toFixed(1)}% avgQ=${avgQuestions.toFixed(1)}\n`,
      )
    }
  }
}

// ── Phase 1 results ───────────────────────────────────────────────────────────

if (gridResults.length > 0) {
  markParetoFront(gridResults)
  const paretoFront = gridResults.filter((r) => r.pareto)
  const sortedAll = gridResults.slice().sort((a, b) => b.winRate - a.winRate || a.avgQuestions - b.avgQuestions)

  console.log('\n── Phase 1 Pareto Front (Win Rate + Avg Questions) ──────────────────────────────')
  console.log(
    `  ${'Match'.padStart(5)} ${'Msmt'.padStart(5)} ${'Maybe'.padStart(5)} ${'MM2'.padStart(5)}` +
    `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)} ${'Wins'.padStart(5)}`,
  )
  console.log('  ' + '─'.repeat(52))
  for (const r of paretoFront.sort((a, b) => b.winRate - a.winRate || a.avgQuestions - b.avgQuestions)) {
    console.log(
      `  ${String(r.weights.match).padStart(5)} ${String(r.weights.mismatch).padStart(5)} ` +
      `${String(r.weights.maybe).padStart(5)} ${String(r.weights.maybeMiss).padStart(5)}` +
      `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)} ` +
      `${String(r.wins).padStart(4)}/${r.total}`,
    )
  }

  console.log('\n── Phase 1 Top 10 by Win Rate ───────────────────────────────────────────────────')
  console.log(
    `  ${'Match'.padStart(5)} ${'Msmt'.padStart(5)} ${'Maybe'.padStart(5)} ${'MM2'.padStart(5)}` +
    `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)} ${'Pareto'}`,
  )
  console.log('  ' + '─'.repeat(56))
  for (const r of sortedAll.slice(0, 10)) {
    console.log(
      `  ${String(r.weights.match).padStart(5)} ${String(r.weights.mismatch).padStart(5)} ` +
      `${String(r.weights.maybe).padStart(5)} ${String(r.weights.maybeMiss).padStart(5)}` +
      `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)}  ${r.pareto ? '★' : ' '}`,
    )
  }

  console.log('\n── Phase 1 Bottom 10 by Win Rate ────────────────────────────────────────────────')
  console.log(
    `  ${'Match'.padStart(5)} ${'Msmt'.padStart(5)} ${'Maybe'.padStart(5)} ${'MM2'.padStart(5)}` +
    `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)}`,
  )
  console.log('  ' + '─'.repeat(50))
  for (const r of sortedAll.slice(-10).reverse()) {
    console.log(
      `  ${String(r.weights.match).padStart(5)} ${String(r.weights.mismatch).padStart(5)} ` +
      `${String(r.weights.maybe).padStart(5)} ${String(r.weights.maybeMiss).padStart(5)}` +
      `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)}`,
    )
  }

  // Production baseline rank
  const prod = sortedAll.find(
    (r) => r.weights.match === 1.0 && r.weights.mismatch === 0.03 &&
           r.weights.maybe === 0.7 && r.weights.maybeMiss === 0.3,
  )
  if (prod) {
    const rank = sortedAll.indexOf(prod) + 1
    console.log(
      `\n── Phase 1 production baseline (match=1.0 mm=0.03 maybe=0.7 mm2=0.3): ` +
      `rank #${rank}/${gridResults.length} | win=${(prod.winRate * 100).toFixed(1)}% avgQ=${prod.avgQuestions.toFixed(1)}${prod.pareto ? ' ★ Pareto' : ''}`,
    )
  }

  // Write Phase 1 output
  const p1Out = join(DATA_DIR, 'grid-search-phase1.jsonl')
  writeFileSync(p1Out, sortedAll.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  console.log(`\nPhase 1 results written to ${p1Out}`)
}

// ── Phase 2 results ───────────────────────────────────────────────────────────

if (structuralResults.length > 0) {
  markParetoFront(structuralResults)
  const paretoFront2 = structuralResults.filter((r) => r.pareto)
  const sortedAll2 = structuralResults.slice().sort((a, b) => b.winRate - a.winRate || a.avgQuestions - b.avgQuestions)

  console.log('\n── Phase 2 Pareto Front (Win Rate + Avg Questions) ──────────────────────────────')
  console.log(
    `  ${'DGP'.padStart(5)} ${'DCP'.padStart(5)} ${'TSB'.padStart(5)} ${'TOB'.padStart(5)} ${'EFT'.padStart(5)}` +
    `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)} ${'Wins'.padStart(5)}`,
  )
  console.log('  ' + '─'.repeat(62))
  for (const r of paretoFront2.sort((a, b) => b.winRate - a.winRate || a.avgQuestions - b.avgQuestions)) {
    const w = r.weights
    console.log(
      `  ${String(w.diversityGroupPenalty).padStart(5)} ${String(w.diversityCategoryPenalty).padStart(5)} ` +
      `${String(w.taxonomySpeciesBoost).padStart(5)} ${String(w.taxonomyOriginBoost).padStart(5)} ${String(w.endgameFocusThreshold).padStart(5)}` +
      `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)} ` +
      `${String(r.wins).padStart(4)}/${r.total}`,
    )
  }

  console.log('\n── Phase 2 Top 10 by Win Rate ───────────────────────────────────────────────────')
  console.log(
    `  ${'DGP'.padStart(5)} ${'DCP'.padStart(5)} ${'TSB'.padStart(5)} ${'TOB'.padStart(5)} ${'EFT'.padStart(5)}` +
    `  ${'Win%'.padStart(6)} ${'AvgQ'.padStart(6)} ${'Pareto'}`,
  )
  console.log('  ' + '─'.repeat(66))
  for (const r of sortedAll2.slice(0, 10)) {
    const w = r.weights
    console.log(
      `  ${String(w.diversityGroupPenalty).padStart(5)} ${String(w.diversityCategoryPenalty).padStart(5)} ` +
      `${String(w.taxonomySpeciesBoost).padStart(5)} ${String(w.taxonomyOriginBoost).padStart(5)} ${String(w.endgameFocusThreshold).padStart(5)}` +
      `  ${(r.winRate * 100).toFixed(1).padStart(5)}% ${r.avgQuestions.toFixed(1).padStart(6)}  ${r.pareto ? '★' : ' '}`,
    )
  }

  // Production baseline (default constants)
  const prodSW = sortedAll2.find(
    (r) =>
      r.weights.diversityGroupPenalty === 0.75 &&
      r.weights.diversityCategoryPenalty === 0.8 &&
      r.weights.taxonomySpeciesBoost === 2.0 &&
      r.weights.taxonomyOriginBoost === 1.3 &&
      r.weights.endgameFocusThreshold === 0.65,
  )
  if (prodSW) {
    const rank = sortedAll2.indexOf(prodSW) + 1
    console.log(
      `\n── Phase 2 production baseline (dgp=0.75 dcp=0.8 tsb=2.0 tob=1.3 eft=0.65): ` +
      `rank #${rank}/${structuralResults.length} | win=${(prodSW.winRate * 100).toFixed(1)}% avgQ=${prodSW.avgQuestions.toFixed(1)}${prodSW.pareto ? ' ★ Pareto' : ''}`,
    )
  }

  // Write Phase 2 output
  const p2Out = join(DATA_DIR, 'grid-search-phase2.jsonl')
  writeFileSync(p2Out, sortedAll2.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  console.log(`\nPhase 2 results written to ${p2Out}`)
}

// ── Combined JSONL output (legacy --output flag) ──────────────────────────────

if (OUTPUT_FILE) {
  mkdirSync(DATA_DIR, { recursive: true })
  const outPath = OUTPUT_FILE.startsWith('/') ? OUTPUT_FILE : join(DATA_DIR, OUTPUT_FILE)
  const allLines = [
    ...gridResults.map((r) => JSON.stringify({ phase: 1, ...r })),
    ...structuralResults.map((r) => JSON.stringify({ phase: 2, ...r })),
  ].join('\n') + '\n'
  writeFileSync(outPath, allLines, 'utf8')
  console.log(`\nCombined grid results written to ${outPath}`)
}
