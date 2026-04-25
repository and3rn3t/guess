#!/usr/bin/env -S npx tsx
/**
 * Head-to-head race: greedy entropy (selectBestQuestion) vs 2-step look-ahead (selectBestQuestionMCTS).
 *
 * Both engines run on the same character pool and target set.  After every game
 * the script records which engine guessed first, or if it was a tie.
 *
 * Usage:
 *   pnpm simulate:race                            # 100 random targets, medium
 *   pnpm simulate:race --sample 200               # more targets
 *   pnpm simulate:race --difficulty hard
 *   pnpm simulate:race --all                      # full character pool
 *   pnpm simulate:race --output race-results.json
 *
 * Output: summary table + optional JSON file with per-character breakdown.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateProbabilities,
  evaluateGuessReadiness,
  selectBestQuestion,
  selectBestQuestionMCTS,
} from '@guess/game-engine'
import type { AnswerValue, GameAnswer, ScoringOptions, GuessTrigger } from '@guess/game-engine'
import { DIFFICULTY_MAP } from './engine.js'
import type { SimCharacter, SimQuestion } from './engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')

// ── CLI ───────────────────────────────────────────────────────────────────────

function flag(name: string): boolean { return process.argv.includes(`--${name}`) }
function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null
}

const ALL = flag('all')
const SAMPLE = arg('sample') ? parseInt(arg('sample')!, 10) : 100
const DIFFICULTY = arg('difficulty') ?? 'medium'
const OUTPUT_FILE = arg('output')

if (!DIFFICULTY_MAP[DIFFICULTY]) {
  console.error(`Unknown difficulty "${DIFFICULTY}". Choose easy, medium, or hard.`)
  process.exit(1)
}

const MAX_QUESTIONS = DIFFICULTY_MAP[DIFFICULTY]!

// ── Load data ─────────────────────────────────────────────────────────────────

const charsPath = join(DATA_DIR, 'characters.json')
const questionsPath = join(DATA_DIR, 'questions.json')

if (!existsSync(charsPath) || !existsSync(questionsPath)) {
  console.error('Data not found — run `pnpm simulate:export` first.')
  process.exit(1)
}

const allChars: SimCharacter[] = JSON.parse(readFileSync(charsPath, 'utf8'))
const allQuestions: SimQuestion[] = JSON.parse(readFileSync(questionsPath, 'utf8'))

// ── Types ─────────────────────────────────────────────────────────────────────

type EngineName = 'greedy' | 'mcts'

interface RaceGame {
  targetId: string
  targetName: string
  greedy: { won: boolean; questions: number; trigger: GuessTrigger | null }
  mcts:   { won: boolean; questions: number; trigger: GuessTrigger | null }
  winner: EngineName | 'tie' | 'both-lost'
}

// ── Oracle ────────────────────────────────────────────────────────────────────

function oracle(target: SimCharacter, attribute: string): AnswerValue {
  const v = target.attributes[attribute]
  if (v === true) return 'yes'
  if (v === false) return 'no'
  return 'unknown'
}

function filterPool(chars: SimCharacter[], answers: GameAnswer[], rejected: Set<string>): SimCharacter[] {
  return chars.filter((c) => {
    if (rejected.has(c.id)) return false
    let mismatches = 0
    for (const a of answers) {
      const attr = c.attributes[a.questionId]
      if (a.value === 'yes' && attr === false) mismatches++
      else if (a.value === 'no' && attr === true) mismatches++
      if (mismatches > 2) return false
    }
    return true
  })
}

// ── Single engine simulation ──────────────────────────────────────────────────

type SelectFn = typeof selectBestQuestion

function runEngine(
  target: SimCharacter,
  pool: SimCharacter[],
  questions: SimQuestion[],
  maxQ: number,
  selectFn: SelectFn,
): { won: boolean; questions: number; trigger: GuessTrigger | null } {
  const answers: GameAnswer[] = []
  const rejected = new Set<string>()
  const maxQDynamic = maxQ

  for (let q = 0; q < maxQDynamic; q++) {
    const workingPool = filterPool(pool, answers, rejected)
    if (workingPool.length === 0) break

    const scoring: ScoringOptions = {}
    const probs = calculateProbabilities(workingPool, answers, scoring)
    const progress = q / maxQDynamic

    const readiness = evaluateGuessReadiness(workingPool, answers, q, maxQDynamic, 0, scoring, probs)

    if (readiness.shouldGuess) {
      // Find the top guess
      const sorted = Array.from(probs.entries()).sort((a, b) => b[1] - a[1])
      const guessId = sorted[0]?.[0]
      const won = guessId === target.id
      return { won, questions: q, trigger: readiness.trigger }
    }

    const nextQ = selectFn(
      workingPool,
      answers,
      questions,
      { progress, probs }
    )
    if (!nextQ) break

    const answer = oracle(target, nextQ.attribute)
    answers.push({ questionId: nextQ.attribute, value: answer })
  }

  // Last-resort guess
  const finalPool = filterPool(pool, answers, rejected)
  if (finalPool.length === 0) return { won: false, questions: maxQDynamic, trigger: null }
  const finalProbs = calculateProbabilities(finalPool, answers, {})
  const top = Array.from(finalProbs.entries()).sort((a, b) => b[1] - a[1])[0]
  const won = top?.[0] === target.id
  return { won, questions: maxQDynamic, trigger: 'max_questions' }
}

// ── Race ──────────────────────────────────────────────────────────────────────

const targets = ALL
  ? allChars
  : allChars.slice().sort(() => Math.random() - 0.5).slice(0, SAMPLE)

console.log(
  `\nHead-to-head race: Greedy vs MCTS  |  ${targets.length} characters  |  difficulty: ${DIFFICULTY}  |  maxQ: ${MAX_QUESTIONS}`
)
console.log('─'.repeat(72))

const games: RaceGame[] = []
let greedyWins = 0, mctsWins = 0, ties = 0, bothLost = 0

for (let i = 0; i < targets.length; i++) {
  const target = targets[i]!
  if ((i + 1) % 25 === 0) process.stdout.write(`  Progress: ${i + 1}/${targets.length}\n`)

  const greedyResult = runEngine(target, allChars, allQuestions, MAX_QUESTIONS, selectBestQuestion)
  const mctsResult   = runEngine(target, allChars, allQuestions, MAX_QUESTIONS,
    (chars, answers, qs, opts) => selectBestQuestionMCTS(chars, answers, qs, opts)
  )

  let winner: RaceGame['winner']
  if (!greedyResult.won && !mctsResult.won) {
    winner = 'both-lost'; bothLost++
  } else if (greedyResult.won && !mctsResult.won) {
    winner = 'greedy'; greedyWins++
  } else if (mctsResult.won && !greedyResult.won) {
    winner = 'mcts'; mctsWins++
  } else {
    // Both won — winner is whoever used fewer questions
    if (greedyResult.questions < mctsResult.questions) { winner = 'greedy'; greedyWins++ }
    else if (mctsResult.questions < greedyResult.questions) { winner = 'mcts'; mctsWins++ }
    else { winner = 'tie'; ties++ }
  }

  games.push({ targetId: target.id, targetName: target.name, greedy: greedyResult, mcts: mctsResult, winner })
}

// ── Summary ───────────────────────────────────────────────────────────────────

const n = games.length
const greedyWon  = games.filter((g) => g.greedy.won).length
const mctsWon    = games.filter((g) => g.mcts.won).length
const greedyAvgQ = games.reduce((s, g) => s + g.greedy.questions, 0) / n
const mctsAvgQ   = games.reduce((s, g) => s + g.mcts.questions, 0) / n

console.log()
console.log('═'.repeat(72))
console.log('  RESULTS')
console.log('═'.repeat(72))
console.log(
  `  ${'Engine'.padEnd(12)} ${'Win rate'.padStart(9)} ${'Avg Q'.padStart(8)} ${'Wins'.padStart(8)}`
)
console.log('  ' + '─'.repeat(42))
console.log(
  `  ${'Greedy'.padEnd(12)} ${((greedyWon / n) * 100).toFixed(1).padStart(8)}%` +
  ` ${greedyAvgQ.toFixed(2).padStart(8)}  ${String(greedyWon).padStart(6)}/${n}`
)
console.log(
  `  ${'MCTS'.padEnd(12)} ${((mctsWon / n) * 100).toFixed(1).padStart(8)}%` +
  ` ${mctsAvgQ.toFixed(2).padStart(8)}  ${String(mctsWon).padStart(6)}/${n}`
)
console.log()
console.log(`  Head-to-head:`)
console.log(`    Greedy wins: ${greedyWins}  |  MCTS wins: ${mctsWins}  |  Ties: ${ties}  |  Both lost: ${bothLost}`)

const winRateDelta = ((mctsWon - greedyWon) / n) * 100
const avgQDelta = mctsAvgQ - greedyAvgQ
const winSign = winRateDelta >= 0 ? '+' : ''
const qSign   = avgQDelta >= 0 ? '+' : ''
console.log()
console.log(`  MCTS vs Greedy Δ:  win rate ${winSign}${winRateDelta.toFixed(2)} pp  |  avg Q ${qSign}${avgQDelta.toFixed(3)}`)
console.log('═'.repeat(72))

// ── Worst mismatches (characters where engines disagreed most) ────────────────

const disagreements = games
  .filter((g) => g.winner !== 'tie' && g.winner !== 'both-lost')
  .map((g) => ({
    name: g.targetName,
    winner: g.winner,
    greedyQ: g.greedy.questions,
    mctsQ: g.mcts.questions,
    delta: Math.abs(g.greedy.questions - g.mcts.questions),
  }))
  .sort((a, b) => b.delta - a.delta)
  .slice(0, 10)

if (disagreements.length > 0) {
  console.log('\n  Top disagreements (largest Q delta):')
  console.log(`  ${'Character'.padEnd(28)} ${'Winner'.padEnd(8)} ${'Greedy Q'.padStart(9)} ${'MCTS Q'.padStart(8)}`)
  console.log('  ' + '─'.repeat(57))
  for (const d of disagreements) {
    console.log(
      `  ${d.name.slice(0, 27).padEnd(28)} ${d.winner.padEnd(8)}` +
      ` ${String(d.greedyQ).padStart(9)} ${String(d.mctsQ).padStart(8)}`
    )
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

if (OUTPUT_FILE) {
  const outPath = OUTPUT_FILE.startsWith('/') ? OUTPUT_FILE : join(DATA_DIR, OUTPUT_FILE)
  writeFileSync(outPath, JSON.stringify({ summary: { n, greedyWon, mctsWon, greedyWins, mctsWins, ties, bothLost, greedyAvgQ, mctsAvgQ }, games }, null, 2))
  console.log(`\n  Results written to ${outPath}`)
}
