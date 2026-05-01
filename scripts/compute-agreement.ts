#!/usr/bin/env npx tsx
/**
 * Compute cross-source agreement scores (DQ.3) for every (character, attribute)
 * row in `character_attributes` and write them back to D1.
 *
 * Sources of signal:
 *   • game_reveals       — confident yes/no player answers per attribute
 *   • attribute_disputes — open / dismissed / resolved disputes
 *
 * Pure scoring logic lives in `functions/api/_agreement.ts` so it can be
 * unit-tested. This script is the I/O wrapper: it shells out to wrangler to
 * read D1, builds AgreementSignal[] per (character, attribute) pair, calls
 * the scorer, then emits batched UPDATE statements.
 *
 * Usage:
 *   npx tsx scripts/compute-agreement.ts [--env preview|production] [--days N] [--dry-run]
 *
 * Defaults:
 *   --env production
 *   --days 90  (window of game_reveals to consider)
 *
 * Designed to run nightly via the existing adaptive-data-refresh Cron once
 * H.3 is wired; for now intended for manual + CI invocation.
 */

import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  computeAgreementScore,
  type AgreementSignal,
} from '../functions/api/_agreement'

const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? (process.argv[i + 1] ?? 'production') : 'production'
})()
const DAYS = (() => {
  const i = process.argv.indexOf('--days')
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? '90', 10) : 90
})()
const DRY_RUN = process.argv.includes('--dry-run')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const OUT_DIR = path.join('data', 'agreement')
fs.mkdirSync(OUT_DIR, { recursive: true })

const cutoff = Date.now() - DAYS * 86400 * 1000

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }
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

interface DisputeRow {
  character_id: string
  attribute_key: string
  current_value: number | null
  status: 'open' | 'resolved' | 'dismissed'
}

function key(charId: string, attr: string): string {
  return `${charId}\u0001${attr}`
}

console.log(`[agreement] env=${ENV_FLAG} days=${DAYS} dry-run=${DRY_RUN}`)

// ── 1. Load all stored attribute values (the source of truth we score against)
console.log('[agreement] loading character_attributes ...')
const attributes = d1<AttributeRow>(
  `SELECT character_id, attribute_key, value
   FROM character_attributes
   WHERE value IS NOT NULL`
)
const stored = new Map<string, number>()
for (const row of attributes) {
  if (row.value === null) continue
  stored.set(key(row.character_id, row.attribute_key), row.value)
}
console.log(`[agreement]   ${stored.size} stored values`)

// ── 2. Bucket reveal signals by (character, attribute)
console.log(`[agreement] loading game_reveals (last ${DAYS}d) ...`)
const reveals = d1<RevealRow>(
  `SELECT actual_character_id, answers
   FROM game_reveals
   WHERE created_at > ${Math.floor(cutoff / 1000)}
     AND actual_character_id IS NOT NULL`
)
console.log(`[agreement]   ${reveals.length} reveals`)

const signalsByPair = new Map<string, AgreementSignal[]>()
function pushSignal(charId: string, attr: string, signal: AgreementSignal): void {
  const k = key(charId, attr)
  const list = signalsByPair.get(k)
  if (list) list.push(signal)
  else signalsByPair.set(k, [signal])
}

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
    const storedValue = stored.get(key(reveal.actual_character_id, ans.questionId))
    if (storedValue === undefined) continue
    const playerValue = ans.value === 'yes' ? 1 : 0
    pushSignal(reveal.actual_character_id, ans.questionId, {
      source: 'reveal',
      agrees: playerValue === storedValue,
    })
  }
}

// ── 3. Bucket dispute signals
console.log('[agreement] loading attribute_disputes ...')
const disputes = d1<DisputeRow>(
  `SELECT character_id, attribute_key, current_value, status
   FROM attribute_disputes`
)
console.log(`[agreement]   ${disputes.length} disputes`)

for (const d of disputes) {
  const storedValue = stored.get(key(d.character_id, d.attribute_key))
  if (storedValue === undefined) continue
  const sameAsCurrent = d.current_value === storedValue
  if (d.status === 'open') {
    // Skeptic LLM still flags it — disagreement signal regardless of value parity.
    pushSignal(d.character_id, d.attribute_key, { source: 'dispute-open', agrees: false })
  } else if (d.status === 'dismissed') {
    // Reviewer rejected the dispute → corroborates current stored value.
    pushSignal(d.character_id, d.attribute_key, { source: 'dispute-dismissed', agrees: true })
  } else if (d.status === 'resolved') {
    // Resolved means the stored value was changed; if current value still
    // matches what was disputed, that's incoherent — score as disagreement.
    pushSignal(d.character_id, d.attribute_key, {
      source: 'dispute-resolved',
      agrees: !sameAsCurrent,
    })
  }
}

// ── 4. Score and emit UPDATE batches
console.log(`[agreement] scoring ${signalsByPair.size} pairs with signals ...`)
const updates: Array<{ charId: string; attr: string; score: number; signals: number }> = []
for (const [k, signals] of signalsByPair) {
  const result = computeAgreementScore(signals)
  if (result.score === null) continue
  const sep = k.indexOf('\u0001')
  updates.push({
    charId: k.slice(0, sep),
    attr: k.slice(sep + 1),
    score: result.score,
    signals: result.signalCount,
  })
}
console.log(`[agreement]   ${updates.length} pairs scored`)

if (updates.length === 0) {
  console.log('[agreement] nothing to write — exiting.')
  process.exit(0)
}

// Distribution summary
const buckets = { contested: 0, weak: 0, strong: 0 }
for (const u of updates) {
  if (u.score < 0.6) buckets.contested++
  else if (u.score < 0.85) buckets.weak++
  else buckets.strong++
}
console.log(
  `[agreement] distribution: contested=${buckets.contested} weak=${buckets.weak} strong=${buckets.strong}`
)

// Generate SQL output
const headerLines = [
  '-- Generated by scripts/compute-agreement.ts (DQ.3)',
  `-- env=${ENV_FLAG} days=${DAYS} pairs=${updates.length}`,
  `-- generated_at=${new Date().toISOString()}`,
  'BEGIN TRANSACTION;',
]
const updateLines = updates.map((u) => {
  const charId = u.charId.replaceAll("'", "''")
  const attr = u.attr.replaceAll("'", "''")
  return `UPDATE character_attributes SET agreement_score = ${u.score}, agreement_signals = ${u.signals} WHERE character_id = '${charId}' AND attribute_key = '${attr}';`
})
const lines = [...headerLines, ...updateLines, 'COMMIT;']

const outFile = path.join(OUT_DIR, `agreement-${ENV_FLAG}.sql`)
fs.writeFileSync(outFile, lines.join('\n'))
console.log(`[agreement] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`)

if (DRY_RUN) {
  console.log('[agreement] dry-run: skipping D1 write.')
  process.exit(0)
}

console.log('[agreement] applying to D1 ...')
execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--file', outFile],
  { stdio: 'inherit' }
)
console.log('[agreement] done.')
