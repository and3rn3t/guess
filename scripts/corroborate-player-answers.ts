#!/usr/bin/env npx tsx
/**
 * Player-answer corroboration loop (DQ.5)
 *
 * For every (character, attribute) pair where players have submitted ≥20
 * confident yes/no answers via game-end reveals, compare the player majority
 * to the value stored in `character_attributes`. When >70% of those player
 * answers disagree with the stored value, file an `attribute_disputes` row
 * with `disputed_by='player-corroboration'` so the row enters the existing
 * skeptic-queue review surface.
 *
 * Source signal:
 *   • game_reveals.answers JSON   — `[{ questionId, value: 'yes'|'no'|... }]`
 *     (the player names the character at game-end; we already store the
 *     full answer log alongside `actual_character_id`)
 *
 * Pure logic lives in `functions/api/_corroboration.ts` and is unit-tested.
 * This script is the I/O wrapper: it shells out to wrangler to read D1,
 * buckets votes per (character, attribute) pair, calls the evaluator, then
 * emits an `INSERT OR IGNORE` batch (idempotent thanks to the existing
 * `UNIQUE(character_id, attribute_key, status)` constraint on the table).
 *
 * Usage:
 *   npx tsx scripts/corroborate-player-answers.ts [--env preview|production]
 *                                                 [--days N] [--min-votes N]
 *                                                 [--threshold 0.7] [--dry-run]
 *
 * Defaults: --env production --days 180 --min-votes 20 --threshold 0.7
 *
 * Designed to run nightly via the H.3 cron alongside compute-agreement.ts.
 */

import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  DEFAULT_DISAGREEMENT_THRESHOLD,
  DEFAULT_MIN_VOTES,
  disagreementToConfidence,
  evaluateCorroboration,
  type PlayerVote,
} from '../functions/api/_corroboration'

function flagValue(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const ENV_FLAG = flagValue('--env', 'production')
const DAYS = Number.parseInt(flagValue('--days', '180'), 10)
const MIN_VOTES = Number.parseInt(flagValue('--min-votes', String(DEFAULT_MIN_VOTES)), 10)
const THRESHOLD = Number.parseFloat(
  flagValue('--threshold', String(DEFAULT_DISAGREEMENT_THRESHOLD))
)
const DRY_RUN = process.argv.includes('--dry-run')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const OUT_DIR = path.join('data', 'corroboration')
fs.mkdirSync(OUT_DIR, { recursive: true })

const cutoffSeconds = Math.floor((Date.now() - DAYS * 86400 * 1000) / 1000)

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 500 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

interface AttributeRow {
  character_id: string
  attribute_key: string
  value: number | null
}

interface RevealRow {
  actual_character_id: string
  answers: string
}

function key(charId: string, attr: string): string {
  return `${charId}\u0001${attr}`
}

console.log(
  `[corroboration] env=${ENV_FLAG} days=${DAYS} min-votes=${MIN_VOTES} threshold=${THRESHOLD} dry-run=${DRY_RUN}`
)

// ── 1. Load reveals first; we only need attributes for characters that appear here.
console.log(`[corroboration] loading game_reveals (last ${DAYS}d) ...`)
const reveals = d1<RevealRow>(
  `SELECT actual_character_id, answers
   FROM game_reveals
   WHERE created_at > ${cutoffSeconds}
     AND actual_character_id IS NOT NULL`
)
console.log(`[corroboration]   ${reveals.length} reveals`)

if (reveals.length === 0) {
  console.log('[corroboration] no reveals in window — exiting.')
  process.exit(0)
}

const revealedCharIds = new Set<string>()
for (const r of reveals) revealedCharIds.add(r.actual_character_id)
console.log(`[corroboration]   ${revealedCharIds.size} distinct revealed characters`)

// ── 2. Load stored values only for revealed characters (keeps payload small)
const ids = [...revealedCharIds].map((id) => `'${id.replaceAll("'", "''")}'`).join(',')
console.log('[corroboration] loading character_attributes for revealed chars ...')
const attributes = d1<AttributeRow>(
  `SELECT character_id, attribute_key, value
   FROM character_attributes
   WHERE value IS NOT NULL
     AND character_id IN (${ids})`
)
const stored = new Map<string, 0 | 1>()
for (const row of attributes) {
  if (row.value === 0 || row.value === 1) {
    stored.set(key(row.character_id, row.attribute_key), row.value)
  }
}
console.log(`[corroboration]   ${stored.size} stored boolean values`)

// ── 3. Bucket player votes per (character, attribute)
const votesByPair = new Map<string, PlayerVote[]>()
for (const reveal of reveals) {
  let answers: Array<{ questionId?: string; value?: string }>
  try {
    answers = JSON.parse(reveal.answers)
  } catch {
    continue
  }
  if (!Array.isArray(answers)) continue
  for (const ans of answers) {
    if (!ans.questionId) continue
    if (ans.value !== 'yes' && ans.value !== 'no') continue
    if (!stored.has(key(reveal.actual_character_id, ans.questionId))) continue
    const k = key(reveal.actual_character_id, ans.questionId)
    const list = votesByPair.get(k)
    const vote: PlayerVote = { value: ans.value === 'yes' ? 1 : 0 }
    if (list) list.push(vote)
    else votesByPair.set(k, [vote])
  }
}
console.log(`[corroboration]   ${votesByPair.size} pairs with player signal`)

// ── 4. Evaluate and collect disputes
interface DisputeRow {
  charId: string
  attr: string
  storedValue: 0 | 1
  suggestedValue: 0 | 1
  totalVotes: number
  disagreementRate: number
  reason: string
  confidence: number
}

const disputes: DisputeRow[] = []
let evaluated = 0
let metVolume = 0

for (const [k, votes] of votesByPair) {
  if (votes.length < MIN_VOTES) continue
  metVolume++
  const sep = k.indexOf('\u0001')
  const charId = k.slice(0, sep)
  const attr = k.slice(sep + 1)
  const storedValue = stored.get(k)
  if (storedValue === undefined) continue
  evaluated++
  const result = evaluateCorroboration(votes, storedValue, {
    minVotes: MIN_VOTES,
    disagreementThreshold: THRESHOLD,
  })
  if (!result.shouldDispute || result.suggestedValue === null) continue
  disputes.push({
    charId,
    attr,
    storedValue,
    suggestedValue: result.suggestedValue,
    totalVotes: result.totalVotes,
    disagreementRate: result.disagreementRate,
    reason: result.reason,
    confidence: disagreementToConfidence(result.disagreementRate, THRESHOLD),
  })
}

console.log(
  `[corroboration]   ${metVolume} pairs >= min-votes; ${evaluated} evaluated; ${disputes.length} dispute candidates`
)

if (disputes.length === 0) {
  console.log('[corroboration] no disputes to file — exiting.')
  process.exit(0)
}

// Distribution summary
const top = [...disputes].sort((a, b) => b.disagreementRate - a.disagreementRate).slice(0, 10)
console.log('[corroboration] top 10 by disagreement rate:')
for (const d of top) {
  console.log(
    `  ${d.charId}/${d.attr}  stored=${d.storedValue} suggest=${d.suggestedValue}  ${(d.disagreementRate * 100).toFixed(1)}% (${d.totalVotes} votes, conf=${d.confidence})`
  )
}

// ── 5. Emit INSERT OR IGNORE batch (idempotent via UNIQUE constraint)
const headerLines = [
  '-- Generated by scripts/corroborate-player-answers.ts (DQ.5)',
  `-- env=${ENV_FLAG} days=${DAYS} min-votes=${MIN_VOTES} threshold=${THRESHOLD}`,
  `-- pairs-evaluated=${evaluated} disputes-filed=${disputes.length}`,
  `-- generated_at=${new Date().toISOString()}`,
  '-- Note: no BEGIN TRANSACTION/COMMIT — D1 remote API rejects raw transaction control statements',
]
const sqlEscape = (s: string): string => s.replaceAll("'", "''")
const insertLines = disputes.map((d) => {
  const charId = sqlEscape(d.charId)
  const attr = sqlEscape(d.attr)
  const reason = sqlEscape(d.reason)
  return `INSERT OR IGNORE INTO attribute_disputes (character_id, attribute_key, current_value, dispute_reason, confidence, disputed_by, status) VALUES ('${charId}', '${attr}', ${d.storedValue}, '${reason}', ${d.confidence}, 'player-corroboration', 'open');`
})
const lines = [...headerLines, ...insertLines]

const outFile = path.join(OUT_DIR, `disputes-${ENV_FLAG}.sql`)
fs.writeFileSync(outFile, lines.join('\n'))
console.log(`[corroboration] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`)

if (DRY_RUN) {
  console.log('[corroboration] dry-run: skipping D1 write.')
  process.exit(0)
}

console.log('[corroboration] applying to D1 ...')
execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--file', outFile],
  { stdio: 'inherit' }
)
console.log('[corroboration] done.')
