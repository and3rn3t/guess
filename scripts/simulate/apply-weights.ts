#!/usr/bin/env -S npx tsx
/**
 * Apply optimal weights from a grid-search JSONL output to constants.ts.
 *
 * Phase 1 (Bayesian scoring weights) — reads grid-search-phase1.jsonl by default:
 *   pnpm simulate:apply-weights                          # dry-run
 *   pnpm simulate:apply-weights --apply                  # write SCORE_* constants
 *   pnpm simulate:apply-weights --input my-grid.jsonl    # custom input
 *   pnpm simulate:apply-weights --strategy pareto        # best Pareto-front point (default)
 *   pnpm simulate:apply-weights --strategy win-rate      # pure highest win-rate
 *   pnpm simulate:apply-weights --strategy balanced      # minimize avgQ within Pareto front
 *
 * Phase 2 (structural constants) — reads grid-search-phase2.jsonl:
 *   pnpm simulate:apply-weights --phase 2                # dry-run structural constants
 *   pnpm simulate:apply-weights --phase 2 --apply        # write structural defaults
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
import type { ScoringWeights, StructuralWeights } from '@guess/game-engine'

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
const PHASE = arg('phase') ?? '1'
const DEFAULT_INPUT = PHASE === '2' ? 'grid-search-phase2.jsonl' : 'grid-search-phase1.jsonl'
const INPUT_FILE = arg('input') ?? join(DATA_DIR, DEFAULT_INPUT)
const STRATEGY = (arg('strategy') ?? 'pareto') as 'pareto' | 'win-rate' | 'balanced'

if (!['1', '2'].includes(PHASE)) {
  console.error(`Unknown phase "${PHASE}". Choose 1 or 2.`)
  process.exit(1)
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Load results ──────────────────────────────────────────────────────────────

if (!existsSync(INPUT_FILE)) {
  console.error(`✗  Grid-search results not found: ${INPUT_FILE}`)
  console.error(`   Run \`pnpm simulate:grid${PHASE === '2' ? ' --phase 2' : ''}\` first.`)
  process.exit(1)
}

const rawLines = readFileSync(INPUT_FILE, 'utf8').split('\n').filter(Boolean)
if (rawLines.length === 0) {
  console.error('✗  No results found in input file.')
  process.exit(1)
}

function selectBest<T extends { winRate: number; avgQuestions: number; pareto: boolean }>(
  results: T[],
  strategy: string,
): T {
  const front = results.filter((r) => r.pareto)
  if (strategy === 'win-rate') return results.reduce((a, b) => (b.winRate > a.winRate ? b : a))
  if (strategy === 'balanced') {
    const pool = front.length > 0 ? front : results
    return pool.reduce((a, b) => (b.avgQuestions < a.avgQuestions ? b : a))
  }
  // 'pareto' default: highest win-rate within Pareto front
  const pool = front.length > 0 ? front : results
  return pool.reduce((a, b) => (b.winRate > a.winRate ? b : a))
}

// ── Phase 1: Bayesian scoring weights ────────────────────────────────────────

if (PHASE === '1') {
  const results: GridResult[] = rawLines.map((l) => JSON.parse(l) as GridResult)
  const pareto = results.filter((r) => r.pareto)
  const best = selectBest(results, STRATEGY)

  const PROD = { match: 1.0, mismatch: 0.03, maybe: 0.7, maybeMiss: 0.3 }

  console.log('\n── Phase 1: Bayesian Scoring Weight Applicator ───────────────────────────────')
  console.log(`  Strategy:  ${STRATEGY}`)
  console.log(`  Input:     ${INPUT_FILE}  (${results.length} grid points, ${pareto.length} Pareto)`)
  console.log()

  const rank = results.findIndex((r) =>
    r.weights.match === best.weights.match &&
    r.weights.mismatch === best.weights.mismatch &&
    r.weights.maybe === best.weights.maybe &&
    r.weights.maybeMiss === best.weights.maybeMiss,
  )
  console.log(`  Selected:  #${rank + 1}/${results.length}${best.pareto ? ' ★ Pareto' : ''}`)
  console.log(
    `  Weights:   match=${best.weights.match}  mismatch=${best.weights.mismatch}  ` +
    `maybe=${best.weights.maybe}  maybeMiss=${best.weights.maybeMiss}`,
  )
  console.log(
    `  Metrics:   win=${(best.winRate * 100).toFixed(2)}%  avgQ=${best.avgQuestions.toFixed(3)}` +
    `  (n=${best.wins}/${best.total})`,
  )
  console.log()

  const changes: Array<{ name: string; from: number; to: number }> = []
  if (best.weights.match    !== PROD.match)      changes.push({ name: 'SCORE_MATCH',     from: PROD.match,     to: best.weights.match! })
  if (best.weights.mismatch !== PROD.mismatch)   changes.push({ name: 'SCORE_MISMATCH',  from: PROD.mismatch,  to: best.weights.mismatch! })
  if (best.weights.maybe    !== PROD.maybe)      changes.push({ name: 'SCORE_MAYBE',     from: PROD.maybe,     to: best.weights.maybe! })
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
  const patches: Record<string, number> = {}
  if (best.weights.match    !== PROD.match)      patches['SCORE_MATCH']     = best.weights.match!
  if (best.weights.mismatch !== PROD.mismatch)   patches['SCORE_MISMATCH']  = best.weights.mismatch!
  if (best.weights.maybe    !== PROD.maybe)      patches['SCORE_MAYBE']     = best.weights.maybe!
  if (best.weights.maybeMiss !== PROD.maybeMiss) patches['SCORE_MAYBE_MISS'] = best.weights.maybeMiss!

  for (const [name, value] of Object.entries(patches)) {
    const re = new RegExp(`(export const ${name}\\s*=\\s*)[\\d.]+`, 'g')
    const newSource = source.replace(re, `$1${value}`)
    if (newSource === source) {
      console.error(`✗  Could not find or replace ${name} in constants.ts`)
      process.exit(1)
    }
    source = newSource
  }

  writeFileSync(CONSTANTS_PATH, source)
  console.log(`  ✓  constants.ts updated (SCORE_* constants).`)
  console.log()
  console.log('  Next steps:')
  console.log('    1. Review the diff:  git diff packages/game-engine/src/constants.ts')
  console.log('    2. Run validation:   pnpm validate')
  console.log('    3. Update baseline:  pnpm simulate:regression --update-baseline')
  console.log('    4. Commit both files if metrics improve.')
  console.log('─'.repeat(80))
}

// ── Phase 2: Structural constants ────────────────────────────────────────────

if (PHASE === '2') {
  const results: StructuralGridResult[] = rawLines.map((l) => JSON.parse(l) as StructuralGridResult)
  const pareto = results.filter((r) => r.pareto)
  const best = selectBest(results, STRATEGY)
  const w = best.weights

  const PROD_SW = {
    diversityGroupPenalty:    0.75,
    diversityCategoryPenalty: 0.8,
    taxonomySpeciesBoost:     2.0,
    taxonomyOriginBoost:      1.3,
    endgameFocusThreshold:    0.65,
  }

  // Map StructuralWeights field names → the constant name in question-selection.ts
  // (these are injectable defaults, so the source-of-truth is in the fallback expressions)
  const FIELD_TO_LABEL: Record<string, string> = {
    diversityGroupPenalty:    'diversityGroupPenalty (default)',
    diversityCategoryPenalty: 'diversityCategoryPenalty (default)',
    taxonomySpeciesBoost:     'taxonomySpeciesBoost (default)',
    taxonomyOriginBoost:      'taxonomyOriginBoost (default)',
    endgameFocusThreshold:    'endgameFocusThreshold (default)',
  }

  console.log('\n── Phase 2: Structural Constants Applicator ──────────────────────────────────')
  console.log(`  Strategy:  ${STRATEGY}`)
  console.log(`  Input:     ${INPUT_FILE}  (${results.length} grid points, ${pareto.length} Pareto)`)
  console.log()

  const rank = results.indexOf(best)
  console.log(`  Selected:  #${rank + 1}/${results.length}${best.pareto ? ' ★ Pareto' : ''}`)
  console.log(
    `  Weights:   dgp=${w.diversityGroupPenalty}  dcp=${w.diversityCategoryPenalty}  ` +
    `tsb=${w.taxonomySpeciesBoost}  tob=${w.taxonomyOriginBoost}  eft=${w.endgameFocusThreshold}`,
  )
  console.log(
    `  Metrics:   win=${(best.winRate * 100).toFixed(2)}%  avgQ=${best.avgQuestions.toFixed(3)}` +
    `  (n=${best.wins}/${best.total})`,
  )
  console.log()

  const changes: Array<{ field: string; label: string; from: number; to: number }> = []
  for (const [field, prodVal] of Object.entries(PROD_SW)) {
    const newVal = (w as Record<string, number | undefined>)[field]
    if (newVal !== undefined && newVal !== prodVal) {
      changes.push({ field, label: FIELD_TO_LABEL[field] ?? field, from: prodVal, to: newVal })
    }
  }

  if (changes.length === 0) {
    console.log('  No changes — selected structural constants match production defaults.')
    console.log('─'.repeat(80))
    process.exit(0)
  }

  console.log('  Proposed changes (update StructuralWeights defaults in question-selection.ts):')
  for (const c of changes) {
    const dir = c.to > c.from ? '▲' : '▼'
    console.log(`    ${dir}  ${c.label.padEnd(38)} ${c.from} → ${c.to}`)
  }
  console.log()

  if (!APPLY) {
    console.log('  Dry-run mode — no files modified.')
    console.log('  Structural constants are injected defaults in question-selection.ts.')
    console.log('  Rerun with --apply to patch the fallback ?? expressions.')
    console.log('─'.repeat(80))
    process.exit(0)
  }

  // Phase 2 patches the ?? fallback values in question-selection.ts
  const QS_PATH = join(__dirname, '..', '..', 'packages', 'game-engine', 'src', 'question-selection.ts')
  if (!existsSync(QS_PATH)) {
    console.error(`✗  question-selection.ts not found at ${QS_PATH}`)
    process.exit(1)
  }

  let source = readFileSync(QS_PATH, 'utf8')

  // Each constant has a pattern like: ?? 0.75  or  ?? 2.0
  // We match against the field name in a nearby comment or the ?? expression.
  // Each pattern captures the field access + `?? ` so we can replace just the default value.
  const patchMap: Record<string, { pattern: RegExp }> = {
    diversityGroupPenalty:    { pattern: /(sw\?\.diversityGroupPenalty\s*\?\?\s*)[\d.]+/ },
    diversityCategoryPenalty: { pattern: /(sw\?\.diversityCategoryPenalty\s*\?\?\s*)[\d.]+/ },
    taxonomySpeciesBoost:     { pattern: /(sw\?\.taxonomySpeciesBoost\s*\?\?\s*)[\d.]+/ },
    taxonomyOriginBoost:      { pattern: /(sw\?\.taxonomyOriginBoost\s*\?\?\s*)[\d.]+/ },
    endgameFocusThreshold:    { pattern: /(sw\?\.endgameFocusThreshold\s*\?\?\s*)[\d.]+/ },
  }

  let patched = 0
  for (const c of changes) {
    const pm = patchMap[c.field]
    if (!pm) continue
    const newSource = source.replace(pm.pattern, `$1${c.to}`)
    if (newSource !== source) {
      source = newSource
      patched++
    } else {
      console.warn(`  ⚠  Could not auto-patch ${c.field} — patch question-selection.ts manually.`)
    }
  }

  if (patched > 0) {
    writeFileSync(QS_PATH, source)
    console.log(`  ✓  question-selection.ts updated (${patched} constant(s) patched).`)
  }

  console.log()
  console.log('  Next steps:')
  console.log('    1. Review the diff:  git diff packages/game-engine/src/question-selection.ts')
  console.log('    2. Run validation:   pnpm validate')
  console.log('    3. Update baseline:  pnpm simulate:regression --update-baseline')
  console.log('    4. Commit if metrics improve.')
  console.log('─'.repeat(80))
}
