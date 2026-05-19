#!/usr/bin/env npx tsx
/**
 * Sparse-attribute auto-fill (DQ.22)
 *
 * Nightly cron that hunts for popular characters with missing attribute
 * values, re-runs the canonical enrichment LLM prompt scoped to *just* the
 * missing keys, and writes the answers back to `character_attributes` with
 * an `enrichment:openai:<model>:run=<iso>` evidence tag (DQ.28 convention).
 *
 * "Popular" = appeared most often as the actual character in finished
 * games over the last 30 days (mirrors `aggregate-real-game-signals.ts`).
 *
 * Pairs with EN.7 schema drift detection: when DQ.21 admits a brand-new
 * attribute, this script will progressively fill it across the catalog
 * starting with the characters players ask about most.
 *
 * Usage:
 *   npx tsx scripts/sparse-fill-attributes.ts
 *     [--env preview|production]
 *     [--budget 200]            # total (char,attr) pairs to fill this run
 *     [--max-per-char 30]       # cap per character so one whale doesn't eat budget
 *     [--days 30]               # popularity lookback window
 *     [--batch-size 5]          # characters per LLM call
 *     [--dry-run]
 *
 * Designed for `.github/workflows/sparse-fill-nightly.yml`. Lives in GH
 * Actions instead of the H.3 Cron Worker because the OpenAI key isn't
 * wired into the CF Worker env.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildSystemPrompt,
  buildUserPrompt,
  loadAttributeDefinitions,
  type AttributeDef,
} from './ingest/enrich.js'
import {
  groupGapsByCategory,
  selectGaps,
  unionMissingKeys,
  type CharacterCandidate,
} from '../functions/api/_sparse_fill.js'
import { withRetry } from './ingest/rate-limiter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'sparse-fill')
mkdirSync(OUT_DIR, { recursive: true })

// ── Env loading (mirrors scripts/golden-regression.ts) ──────────────────────
function loadEnvFiles(): void {
  for (const file of ['.env.local', '.dev.vars']) {
    const p = path.join(REPO_ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      const v = t.slice(i + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  }
}
loadEnvFiles()

// ── CLI args ────────────────────────────────────────────────────────────────
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const ENV_FLAG = flag('--env', 'production')
const BUDGET = Number.parseInt(flag('--budget', '200'), 10)
const MAX_PER_CHAR = Number.parseInt(flag('--max-per-char', '30'), 10)
const DAYS = Number.parseInt(flag('--days', '30'), 10)
const BATCH_SIZE = Number.parseInt(flag('--batch-size', '5'), 10)
const DRY_RUN = process.argv.includes('--dry-run')
// When true, re-attempt (character, attr) pairs previously returned as null by the LLM.
// Default: false — null responses are null-stamped in character_attributes and skipped.
const REFILL_NULLS = process.argv.includes('--refill-nulls')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const MODEL = process.env.SPARSE_FILL_MODEL ?? 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const RUN_ISO = new Date().toISOString()

console.log(
  `[sparse-fill] env=${ENV_FLAG} budget=${BUDGET} max-per-char=${MAX_PER_CHAR} days=${DAYS} batch-size=${BATCH_SIZE} dry-run=${DRY_RUN}`
)
console.log(`[sparse-fill] model=${MODEL}  run=${RUN_ISO}`)

// ── D1 helpers ──────────────────────────────────────────────────────────────
function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 500 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function d1ApplyFile(filePath: string): void {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--file', filePath],
    { stdio: 'inherit' }
  )
}

// ── Compute character popularity (last N days) ──────────────────────────────
const cutoff = Math.floor(Date.now() / 1000) - DAYS * 86400

console.log(`[sparse-fill] computing popularity (cutoff=${cutoff}, ${DAYS}d) ...`)
interface PlayCount {
  character_id: string
  play_count: number
}
const wins = d1<PlayCount>(
  `SELECT character_id, COUNT(*) AS play_count
   FROM game_stats
   WHERE created_at > ${cutoff} AND won = 1 AND character_id IS NOT NULL
   GROUP BY character_id`
)
const reveals = d1<{ actual_character_id: string; play_count: number }>(
  `SELECT actual_character_id, COUNT(*) AS play_count
   FROM game_reveals
   WHERE created_at > ${cutoff} AND actual_character_id IS NOT NULL
   GROUP BY actual_character_id`
)

const playCounts = new Map<string, number>()
for (const r of wins) playCounts.set(r.character_id, (playCounts.get(r.character_id) ?? 0) + r.play_count)
for (const r of reveals)
  playCounts.set(r.actual_character_id, (playCounts.get(r.actual_character_id) ?? 0) + r.play_count)

const maxPlays = Math.max(...playCounts.values(), 1)
console.log(`[sparse-fill]   ${playCounts.size} chars seen (max plays = ${maxPlays})`)

// ── Load all characters (so cold-start chars still get filled, ranked 0) ────
console.log('[sparse-fill] loading characters ...')
interface CharRow {
  id: string
  name: string
  category: string
  description: string | null
}
const allChars = d1<CharRow>(
  `SELECT id, name, category, description FROM characters
   WHERE description IS NOT NULL AND length(description) > 20`
)
console.log(`[sparse-fill]   ${allChars.length} characters with usable descriptions`)
const charById = new Map(allChars.map((c) => [c.id, c]))

// ── Load stored attribute keys per character ────────────────────────────────
console.log('[sparse-fill] loading stored character_attributes (including null-stamps) ...')
interface StoredKey {
  character_id: string
  attribute_key: string
}
const storedRows = d1<StoredKey>(
  // Include null-value rows: they represent a previous "unknown" response and should
  // not consume gap budget again unless --refill-nulls is passed.
  REFILL_NULLS
    ? `SELECT character_id, attribute_key FROM character_attributes WHERE value IS NOT NULL`
    : `SELECT character_id, attribute_key FROM character_attributes`
)
const storedByChar = new Map<string, Set<string>>()
for (const r of storedRows) {
  let s = storedByChar.get(r.character_id)
  if (!s) {
    s = new Set()
    storedByChar.set(r.character_id, s)
  }
  s.add(r.attribute_key)
}
console.log(
  `[sparse-fill]   ${storedRows.length} stored cells (including null-stamps) across ${storedByChar.size} characters`
)

// ── Load attribute schema, group by category ────────────────────────────────
const allAttrs: AttributeDef[] = loadAttributeDefinitions()
const keysByCategory = new Map<string, string[]>()
for (const c of allChars) if (!keysByCategory.has(c.category)) keysByCategory.set(c.category, [])
for (const a of allAttrs) {
  let cats: string[] | null = null
  if (a.categories) {
    try {
      cats = JSON.parse(a.categories) as string[]
    } catch {
      cats = null
    }
  }
  for (const cat of keysByCategory.keys()) {
    if (!cats || cats.includes(cat)) {
      const list = keysByCategory.get(cat)
      if (list) list.push(a.key)
    }
  }
}
console.log(
  `[sparse-fill]   ${allAttrs.length} attribute defs across ${keysByCategory.size} categories`
)

// ── Build candidates and select gaps ────────────────────────────────────────
const candidates: CharacterCandidate[] = allChars.map((c) => ({
  id: c.id,
  category: c.category,
  popularity: (playCounts.get(c.id) ?? 0) / maxPlays,
  storedKeys: storedByChar.get(c.id) ?? new Set<string>(),
}))

const gaps = selectGaps(candidates, keysByCategory, {
  totalGapBudget: BUDGET,
  maxGapsPerCharacter: MAX_PER_CHAR,
})
const totalPairs = gaps.reduce((n, g) => n + g.missingKeys.length, 0)
console.log(
  `[sparse-fill] selected ${gaps.length} characters / ${totalPairs} (char,attr) pairs to fill`
)

if (gaps.length === 0) {
  console.log('[sparse-fill] catalog fully dense within selection criteria — exiting.')
  process.exit(0)
}

// ── OpenAI ──────────────────────────────────────────────────────────────────
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey && !DRY_RUN) {
  console.error('\x1b[31m✗\x1b[0m OPENAI_API_KEY not set — pass --dry-run to skip the LLM call.')
  process.exit(3)
}

interface OpenAIResponse {
  choices: { message: { content: string } }[]
  usage: { prompt_tokens: number; completion_tokens: number }
}
interface CallResult {
  parsed: Record<string, Record<string, boolean | null>>
  promptTokens: number
  completionTokens: number
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<CallResult> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey ?? ''}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`)
  }
  const json = (await res.json()) as OpenAIResponse
  const content = json.choices[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')
  return {
    parsed: JSON.parse(content) as Record<string, Record<string, boolean | null>>,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  }
}

// ── Run LLM batches per category ────────────────────────────────────────────
function boolToValue(b: boolean | null): 0 | 1 | null {
  if (b === true) return 1
  if (b === false) return 0
  return null
}

interface FilledCell {
  characterId: string
  attributeKey: string
  value: 0 | 1 | null
  /** true = LLM returned null; row is written to prevent re-queuing (null-stamp). */
  nullLocked?: boolean
}

const filled: FilledCell[] = []
let totalPromptTokens = 0
let totalCompletionTokens = 0

const grouped = groupGapsByCategory(gaps)
for (const [category, catGaps] of grouped) {
  const askedKeys = unionMissingKeys(catGaps)
  console.log(
    `\n[sparse-fill] category=${category}  ${catGaps.length} chars  asking ${askedKeys.length} attrs/char`
  )

  for (let i = 0; i < catGaps.length; i += BATCH_SIZE) {
    const batch = catGaps.slice(i, i + BATCH_SIZE)
    const batchChars = batch
      .map((g) => charById.get(g.characterId))
      .filter((c): c is CharRow => c !== undefined)
    const systemPrompt = buildSystemPrompt(askedKeys)
    const userPrompt = buildUserPrompt(batchChars)

    if (DRY_RUN) {
      console.log(
        `[sparse-fill]   batch ${i / BATCH_SIZE + 1}/${Math.ceil(catGaps.length / BATCH_SIZE)} (dry-run): would query ${batch.length} chars`
      )
      continue
    }

    let parsed: Record<string, Record<string, boolean | null>>
    try {
      const result = await withRetry(
        () => callLLM(systemPrompt, userPrompt),
        3,
        1000,
        (err) => /OpenAI (429|503|5\d\d)/.test(err.message)
      )
      parsed = result.parsed
      totalPromptTokens += result.promptTokens
      totalCompletionTokens += result.completionTokens
    } catch (err) {
      console.error(
        `[sparse-fill]   batch ${i / BATCH_SIZE + 1} FAILED after retries: ${(err as Error).message}`
      )
      continue
    }

    for (const gap of batch) {
      const fresh = parsed[gap.characterId]
      if (!fresh) {
        console.warn(`[sparse-fill]   ${gap.characterId} — missing from LLM response`)
        continue
      }
      // Only persist the keys we asked for and that weren't already stored.
      for (const key of gap.missingKeys) {
        if (!(key in fresh)) continue
        const v = boolToValue(fresh[key] ?? null)
        // Null-stamp: write null cells so they don't re-consume budget on the next run.
        // The stored row (value IS NULL) is treated as "filled" by the gap selector
        // unless --refill-nulls is passed.
        filled.push({ characterId: gap.characterId, attributeKey: key, value: v, nullLocked: v === null })
      }
    }
    console.log(
      `[sparse-fill]   batch ${i / BATCH_SIZE + 1}/${Math.ceil(catGaps.length / BATCH_SIZE)} done`
    )
  }
}

const realFills = filled.filter(c => !c.nullLocked).length
const nullStamps = filled.filter(c => c.nullLocked).length
console.log(
  `\n[sparse-fill] complete: ${realFills} cells filled, ${nullStamps} null-stamped (out of ${totalPairs} requested)  tokens: prompt=${totalPromptTokens} completion=${totalCompletionTokens}`
)

if (filled.length === 0) {
  console.log('[sparse-fill] nothing to write — exiting.')
  process.exit(0)
}
// ── Emit INSERT OR REPLACE batch ────────────────────────────────────────────
const sqlEscape = (s: string): string => s.replaceAll("'", "''")
const headerLines = [
  '-- Generated by scripts/sparse-fill-attributes.ts (DQ.22)',
  `-- env=${ENV_FLAG} budget=${BUDGET} model=${MODEL}`,
  `-- run=${RUN_ISO}  cells=${filled.length}`,
  '-- Note: no BEGIN TRANSACTION/COMMIT — D1 remote API rejects raw transaction control statements',
]
const insertLines: string[] = []
const CHUNK = 200
for (let i = 0; i < filled.length; i += CHUNK) {
  const chunk = filled.slice(i, i + CHUNK)
  insertLines.push(
    'INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence, evidence) VALUES'
  )
  const nullLockEvidence = `enrichment:null-locked:${MODEL}:run=${RUN_ISO}`
  const fillEvidence = `enrichment:openai:${MODEL}:run=${RUN_ISO}`
  const values = chunk.map((c) => {
    const ev = sqlEscape(c.nullLocked ? nullLockEvidence : fillEvidence)
    const conf = c.nullLocked ? 0.50 : 0.85
    return `  ('${sqlEscape(c.characterId)}', '${sqlEscape(c.attributeKey)}', ${c.value === null ? 'NULL' : c.value}, ${conf}, '${ev}')`
  })
  insertLines.push(values.join(',\n') + ';')
}
const sqlOut = [...headerLines, ...insertLines].join('\n')
const stamp = RUN_ISO.replaceAll(':', '-').replace(/\..+/, '')
const outFile = path.join(OUT_DIR, `fill-${ENV_FLAG}-${stamp}.sql`)
writeFileSync(outFile, sqlOut)
console.log(`[sparse-fill] wrote ${outFile}`)

if (DRY_RUN) {
  console.log('[sparse-fill] dry-run: skipping D1 write.')
  process.exit(0)
}

console.log('[sparse-fill] applying to D1 ...')
d1ApplyFile(outFile)
console.log('[sparse-fill] done.')
