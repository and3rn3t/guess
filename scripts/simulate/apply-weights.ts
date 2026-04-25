#!/usr/bin/env -S npx tsx
/**
 * Apply optimal weights from a grid-search JSONL output to constants.ts.
 *
 * Usage:
 *   pnpm simulate:apply-weights                         # reads data/grid-search-results.jsonl, dry-run
 *   pnpm simulate:apply-weights --apply                 # write changes to constants.ts
 *   pnpm simulate:apply-weights --input my-grid.jsonl   # custom input file
 *   pnpm simulate:apply-weights --strategy pareto       # best Pareto-front point (default)
 *   pnpm simulate:apply-weights --strategy win-rate     # pure highest win-rate
 *   pnpm simulate:apply-weights --strategy balanced     # minimize avgQ within Pareto front
 *
 * The script will:
 *   1. Parse the grid-search results
 *   2. Select the best weights by the chosen strategy
 *   3. Print a diff of the proposed constants.ts changes
 *   4. If --apply, write the changes to packages/game-engine/src/constants.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ScoringWeights } from '@guess/game-engine'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const CONSTANTS_PATH = join(__dirname, '..', '..', 'packages', 'game-engine', 'src', 'constants.ts')

// ── CLI ───────────────────────────────────────────────────────────────────────

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}
function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null
}

const APPLY = flag('apply')
const INPUT_FILE = arg('input') ?? join(DATA_DIR, 'grid-search-results.jsonl')
const STRATEGY = (arg('strategy') ?? 'pareto') as 'pareto' | 'win-rate' | 'balanced'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GridResult {
  weights: ScoringWeights
  winRate: number
  avgQuestions: number
  wins: number
  total: number
  pareto: boolean
}

// ── Load results ──────────────────────────────────────────────────────────────

if (!existsSync(INPUT_FILE)) {
  console.error(`✗  Grid-search results not found: ${INPUT_FILE}`)
  console.error('   Run `pnpm simulate:grid` first.')
  process.exit(1)
}

const lines = readFileSync(INPUT_FILE, 'utf8').split('\n').filter(Boolean)
const results: GridResult[] = lines.map((l) => JSON.parse(l) as GridResult)

if (results.length === 0) {
  console.error('✗  No results found in input file.')
  process.exit(1)
}

const pareto = results.filter((r) => r.pareto)

// ── Select best weights ───────────────────────────────────────────────────────

let best: GridResult

if (STRATEGY === 'win-rate') {
  // Pure highest win-rate (may trade more questions for wins)
  best = results.reduce((a, b) => (b.winRate > a.winRate ? b : a))
} else if (STRATEGY === 'balanced') {
  // Within the Pareto front, pick the one with lowest avgQ
  const front = pareto.length > 0 ? pareto : results
  best = front.reduce((a, b) => (b.avgQuestions < a.avgQuestions ? b : a))
} else {
  // 'pareto' default: within Pareto front, pick highest win-rate
  const front = pareto.length > 0 ? pareto : results
  best = front.reduce((a, b) => (b.winRate > a.winRate ? b : a))
}

// ── Production baseline values ────────────────────────────────────────────────

const PROD = { match: 1.0, mismatch: 0.03, maybe: 0.7, maybeMiss: 0.3 }

// ── Print selection ───────────────────────────────────────────────────────────

console.log('\n── Grid-Search Weight Applicator ─────────────────────────────────────────────')
console.log(`  Strategy:  ${STRATEGY}`)
console.log(`  Input:     ${INPUT_FILE}  (${results.length} grid points, ${pareto.length} Pareto)`)
console.log()

const rank = results.findIndex((r) =>
  r.weights.match === best.weights.match &&
  r.weights.mismatch === best.weights.mismatch &&
  r.weights.maybe === best.weights.maybe &&
  r.weights.maybeMiss === best.weights.maybeMiss
)
console.log(`  Selected:  #${rank + 1}/${results.length}${best.pareto ? ' ★ Pareto' : ''}`)
console.log(
  `  Weights:   match=${best.weights.match}  mismatch=${best.weights.mismatch}  ` +
  `maybe=${best.weights.maybe}  maybeMiss=${best.weights.maybeMiss}`
)
console.log(
  `  Metrics:   win=${(best.winRate * 100).toFixed(2)}%  avgQ=${best.avgQuestions.toFixed(3)}` +
  `  (n=${best.wins}/${best.total})`
)
console.log()

// Diff
const changes: Array<{ name: string; from: number; to: number }> = []
if (best.weights.match    !== PROD.match)     changes.push({ name: 'SCORE_MATCH',    from: PROD.match,    to: best.weights.match! })
if (best.weights.mismatch !== PROD.mismatch)  changes.push({ name: 'SCORE_MISMATCH', from: PROD.mismatch, to: best.weights.mismatch! })
if (best.weights.maybe    !== PROD.maybe)     changes.push({ name: 'SCORE_MAYBE',    from: PROD.maybe,    to: best.weights.maybe! })
if (best.weights.maybeMiss !== PROD.maybeMiss) changes.push({ name: 'SCORE_MAYBE_MISS', from: PROD.maybeMiss, to: best.weights.maybeMiss! })

if (changes.length === 0) {
  console.log('  No changes — selected weights match the current production constants.')
  console.log('─'.repeat(80))
  process.exit(0)
}

console.log('  Proposed changes to constants.ts:')
for (const c of changes) {
  const dir = c.to > c.from ? '▲' : '▼'
  console.log(`    ${dir}  ${c.name.padEnd(18)} ${c.from} → ${c.to}`)
}
console.log()

// ── Apply ─────────────────────────────────────────────────────────────────────

if (!APPLY) {
  console.log('  Dry-run mode — no files modified.')
  console.log('  Rerun with --apply to write changes to constants.ts')
  console.log('─'.repeat(80))
  process.exit(0)
}

if (!existsSync(CONSTANTS_PATH)) {
  console.error(`✗  constants.ts not found at ${CONSTANTS_PATH}`)
  process.exit(1)
}

let source = readFileSync(CONSTANTS_PATH, 'utf8')

// Patch each constant using a targeted regex replacement
const patches: Record<string, number> = {}
if (best.weights.match    !== PROD.match)      patches['SCORE_MATCH']     = best.weights.match!
if (best.weights.mismatch !== PROD.mismatch)   patches['SCORE_MISMATCH']  = best.weights.mismatch!
if (best.weights.maybe    !== PROD.maybe)      patches['SCORE_MAYBE']     = best.weights.maybe!
if (best.weights.maybeMiss !== PROD.maybeMiss) patches['SCORE_MAYBE_MISS'] = best.weights.maybeMiss!

for (const [name, value] of Object.entries(patches)) {
  // Match:  export const SCORE_MATCH = 1.0
  //         export const SCORE_MATCH = 0.8
  const re = new RegExp(`(export const ${name}\\s*=\\s*)[\\d.]+`, 'g')
  const newSource = source.replace(re, `$1${value}`)
  if (newSource === source) {
    console.error(`✗  Could not find or replace ${name} in constants.ts`)
    process.exit(1)
  }
  source = newSource
}

writeFileSync(CONSTANTS_PATH, source)

console.log(`  ✓  constants.ts updated.`)
console.log()
console.log('  Next steps:')
console.log('    1. Review the diff:  git diff packages/game-engine/src/constants.ts')
console.log('    2. Run validation:   pnpm validate')
console.log('    3. Update baseline:  pnpm simulate:regression --update-baseline')
console.log('    4. Commit both files if metrics improve.')
console.log('─'.repeat(80))
