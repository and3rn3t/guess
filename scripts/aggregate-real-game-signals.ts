#!/usr/bin/env npx tsx
/**
 * Aggregate real-game signals from D1 into adaptive KV blobs and a SQL
 * upsert for the `character_confusions` table.
 *
 * Outputs (under data/real/):
 *   attribute-trust.json            \u2014 KV: kv:attribute-trust
 *   character-popularity.json       \u2014 KV: kv:character-popularity
 *   question-empirical-gain.json    \u2014 KV: kv:question-empirical-gain
 *   character-confusions.sql        \u2014 D1: UPSERTs into character_confusions
 *
 * Designed to be invoked by a GitHub Actions workflow (mirrors
 * .github/workflows/adaptive-data-refresh.yml) so it can run on a daily
 * cron and write to production / preview KV via `wrangler kv key put`.
 *
 * Usage:
 *   npx tsx scripts/aggregate-real-game-signals.ts [--env preview|production] [--days N]
 *
 * Defaults:
 *   --env production
 *   --days 30  (window of recent game_stats / question_attempts to consider)
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
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? '30', 10) : 30
})()
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const OUT_DIR = path.join('data', 'real')
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

function writeJson(name: string, data: unknown): void {
  const filePath = path.join(OUT_DIR, name)
  fs.writeFileSync(filePath, JSON.stringify(data))
  console.log(`[aggregate]   wrote ${filePath} (${fs.statSync(filePath).size} bytes)`)
}

// ── Signal 1: attribute trust ────────────────────────────────────────────────
//
// For each attribute key, compute an agreement rate between the stored value
// and the player-disclosed value on losses (from game_reveals). High agreement
// \u2192 trust ~ 1.0; frequent disagreement \u2192 trust drops toward 0.5 (the floor).
// Disputed attributes (attribute_disputes table) are penalised proportionally.
function aggregateAttributeTrust(): void {
  console.log('[aggregate] computing attribute trust ...')

  const disputes = d1<{ attribute_key: string; dispute_count: number }>(
    `SELECT attribute_key, COUNT(*) AS dispute_count
     FROM attribute_disputes
     WHERE created_at > ${cutoff}
     GROUP BY attribute_key`
  )
  const disputeMap = new Map(disputes.map((d) => [d.attribute_key, d.dispute_count]))

  // Probabilistic per-attribute discrepancy share from reveals: each reveal
  // with N answers and D discrepancies contributes D/N to every attribute it
  // touched. Without per-attribute disagreement data this is the best we can
  // do until reveal.ts is extended to emit per-attribute records.
  const reveals = d1<{ answers: string; discrepancies: number }>(
    `SELECT answers, discrepancies
     FROM game_reveals
     WHERE created_at > ${cutoff} AND discrepancies > 0`
  )

  const discrepancyWeight = new Map<string, number>()
  const appearance = new Map<string, number>()
  for (const r of reveals) {
    let answers: Array<{ questionId?: string }>
    try {
      answers = JSON.parse(r.answers) as Array<{ questionId?: string }>
    } catch {
      continue
    }
    if (!Array.isArray(answers) || answers.length === 0) continue
    const ratio = r.discrepancies / answers.length
    for (const a of answers) {
      const key = a.questionId
      if (!key) continue
      discrepancyWeight.set(key, (discrepancyWeight.get(key) ?? 0) + ratio)
      appearance.set(key, (appearance.get(key) ?? 0) + 1)
    }
  }

  const trust: Record<string, number> = {}
  const allAttrs = new Set<string>([...disputeMap.keys(), ...discrepancyWeight.keys()])
  for (const attr of allAttrs) {
    const disputePenalty = Math.min((disputeMap.get(attr) ?? 0) * 0.01, 0.2)
    const totalAppearances = appearance.get(attr) ?? 0
    const discrepancyPenalty = totalAppearances >= 5
      ? Math.min(0.3, (discrepancyWeight.get(attr) ?? 0) / totalAppearances)
      : 0
    const score = 1 - disputePenalty - discrepancyPenalty
    trust[attr] = Math.max(0.5, Math.min(1, Number(score.toFixed(3))))
  }

  console.log(`[aggregate]   ${Object.keys(trust).length} attributes scored`)
  writeJson('attribute-trust.json', trust)
}

// ── Signal 2: character popularity ───────────────────────────────────────────
//
// Per-character empirical prior: how often each character was the actual answer
// of a finished game (won \u2192 character_id == guess; lost+revealed \u2192 from reveal).
// Normalised to [0, 1] within the dataset (max-normalised, like start.ts).
function aggregateCharacterPopularity(): void {
  console.log('[aggregate] computing character popularity ...')
  // Wins: the engine guessed correctly, so character_id IS the answer.
  const wins = d1<{ character_id: string; play_count: number }>(
    `SELECT character_id, COUNT(*) AS play_count
     FROM game_stats
     WHERE created_at > ${cutoff}
       AND won = 1
       AND character_id IS NOT NULL
     GROUP BY character_id`
  )
  // Losses with reveals: the player disclosed the true character.
  const reveals = d1<{ actual_character_id: string; play_count: number }>(
    `SELECT actual_character_id, COUNT(*) AS play_count
     FROM game_reveals
     WHERE created_at > ${cutoff}
       AND actual_character_id IS NOT NULL
     GROUP BY actual_character_id`
  )

  const counts = new Map<string, number>()
  for (const row of wins) counts.set(row.character_id, (counts.get(row.character_id) ?? 0) + row.play_count)
  for (const row of reveals) {
    counts.set(row.actual_character_id, (counts.get(row.actual_character_id) ?? 0) + row.play_count)
  }

  const max = Math.max(...counts.values(), 1)
  const popularity: Record<string, number> = {}
  for (const [id, c] of counts) popularity[id] = Number((c / max).toFixed(4))

  console.log(`[aggregate]   ${Object.keys(popularity).length} characters scored (max plays = ${max})`)
  writeJson('character-popularity.json', popularity)
}

// ── Signal 3: question empirical gain ────────────────────────────────────────
//
// Per-attribute average reduction in candidate count, normalised to [0, 1] by
// dividing by the per-row pre-answer count. Powers a future blend with the
// theoretical info-gain map in question selection.
function aggregateQuestionEmpiricalGain(): void {
  console.log('[aggregate] computing question empirical gain ...')
  const rows = d1<{ attribute: string; n: number; avg_norm_drop: number }>(
    `SELECT attribute,
            COUNT(*) AS n,
            AVG((CAST(candidates_before AS REAL) - candidates_after) / NULLIF(candidates_before, 0)) AS avg_norm_drop
     FROM question_attempts
     WHERE created_at > ${cutoff}
       AND candidates_before IS NOT NULL
       AND candidates_after IS NOT NULL
       AND candidates_before > 0
     GROUP BY attribute
     HAVING n >= 10`
  )

  const gain: Record<string, number> = {}
  for (const row of rows) {
    const value = Math.max(0, Math.min(1, row.avg_norm_drop ?? 0))
    gain[row.attribute] = Number(value.toFixed(4))
  }

  console.log(`[aggregate]   ${Object.keys(gain).length} attributes with empirical gain`)
  writeJson('question-empirical-gain.json', gain)
}

// ── Signal 4: character confusions ───────────────────────────────────────────
//
// Confusion pair = (engine's wrong guess, true answer). Currently the only
// reliable join key between game_stats and game_reveals is created_at + the
// 1-hour session TTL window — imperfect but tractable. Pairs require both:
//   - a `game_stats` row with won=0 and a non-null character_id (engine guess)
//   - a `game_reveals` row created within ±60 seconds of the loss
//
// A future migration should add session_id to game_reveals for an exact join;
// until then this approximation captures most pairs and accepts some noise.
function aggregateCharacterConfusions(): void {
  console.log('[aggregate] computing character confusions ...')
  const rows = d1<{ guessed: string; actual: string; n: number; last_seen: number }>(
    `SELECT gs.character_id AS guessed,
            gr.actual_character_id AS actual,
            COUNT(*) AS n,
            MAX(gs.created_at) AS last_seen
     FROM game_stats gs
     JOIN game_reveals gr
       ON ABS(gs.created_at - gr.created_at) < 60000
     WHERE gs.created_at > ${cutoff}
       AND gs.won = 0
       AND gs.character_id IS NOT NULL
       AND gr.actual_character_id IS NOT NULL
       AND gs.character_id != gr.actual_character_id
     GROUP BY guessed, actual`
  )

  if (rows.length === 0) {
    console.log('[aggregate]   no confusion events in window \u2014 skipping SQL output')
    fs.writeFileSync(path.join(OUT_DIR, 'character-confusions.sql'), '-- no rows\n')
    return
  }

  // Canonicalise pair order (a < b) and merge symmetric counts.
  const pairs = new Map<string, { a: string; b: string; n: number; last_seen: number }>()
  for (const row of rows) {
    const [a, b] = row.guessed < row.actual ? [row.guessed, row.actual] : [row.actual, row.guessed]
    const key = `${a}::${b}`
    const existing = pairs.get(key)
    if (existing) {
      existing.n += row.n
      if (row.last_seen > existing.last_seen) existing.last_seen = row.last_seen
    } else {
      pairs.set(key, { a, b, n: row.n, last_seen: row.last_seen })
    }
  }

  const lines: string[] = ['-- Auto-generated by scripts/aggregate-real-game-signals.ts',
    `-- Generated: ${new Date().toISOString()}`]
  for (const p of pairs.values()) {
    const a = p.a.replaceAll("'", "''")
    const b = p.b.replaceAll("'", "''")
    lines.push(
      `INSERT INTO character_confusions (character_a, character_b, confusion_count, last_seen) ` +
      `VALUES ('${a}', '${b}', ${p.n}, ${p.last_seen}) ` +
      `ON CONFLICT(character_a, character_b) DO UPDATE SET ` +
      `confusion_count = confusion_count + excluded.confusion_count, ` +
      `last_seen = MAX(last_seen, excluded.last_seen);`
    )
  }
  const sql = `${lines.join('\n')}\n`
  const filePath = path.join(OUT_DIR, 'character-confusions.sql')
  fs.writeFileSync(filePath, sql)
  console.log(`[aggregate]   ${pairs.size} unique pairs \u2192 ${filePath}`)
}

console.log(`[aggregate] env=${ENV_FLAG} db=${DB_NAME} window=${DAYS}d`)
aggregateAttributeTrust()
aggregateCharacterPopularity()
aggregateQuestionEmpiricalGain()
aggregateCharacterConfusions()
console.log('[aggregate] done')
