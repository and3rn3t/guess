#!/usr/bin/env npx tsx
/**
 * Nightly attribute reconciliation (DQ.6 / AN.26)
 *
 * Samples N random characters from production D1, re-runs the canonical
 * enrichment LLM prompt against them (same `buildSystemPrompt` /
 * `buildUserPrompt` that ingestion uses), and compares each fresh attribute
 * map to the value currently stored in `character_attributes`. Every
 * difference is appended to `attribute_drift` (migration 0037) tagged with
 * a per-run `batch_id` so EN.28 (provenance-aware rollback) can later
 * scope reverts.
 *
 * Catches three kinds of drift:
 *   • LLM regressions    — a model/prompt-template change flips values
 *   • Upstream changes   — the character description fed to the model has
 *                          drifted (Wikipedia/TMDb edits)
 *   • Knowledge updates  — model now has new knowledge (e.g. retcon)
 *
 * Usage:
 *   npx tsx scripts/reconcile-attributes.ts [--env preview|production]
 *                                            [--sample N] [--batch-size N]
 *                                            [--dry-run]
 *
 * Defaults: --env production --sample 50 --batch-size 5
 *
 * Designed to run nightly via the GitHub Actions workflow at
 * `.github/workflows/reconcile-nightly.yml` (Cloudflare Cron Worker can't
 * call OpenAI directly because the secret lives in CI/dev, not in the CF
 * env). The workflow's schedule is the practical "nightly cron" the
 * acceptance criterion calls for.
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
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
  computeDrift,
  summarizeDrift,
  type AttributeMap,
  type AttributeValue,
  type DriftEvent,
} from '../functions/api/_drift.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'reconcile')
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
const SAMPLE_SIZE = Number.parseInt(flag('--sample', '50'), 10)
const BATCH_SIZE = Number.parseInt(flag('--batch-size', '5'), 10)
const DRY_RUN = process.argv.includes('--dry-run')
const RISK_TIER = flag('--risk-tier', '')
const SAMPLE_FILE = flag('--sample-file', '')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const MODEL = process.env.RECONCILE_MODEL ?? 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const BATCH_ID = randomUUID()

console.log(
  `[reconcile] env=${ENV_FLAG} sample=${SAMPLE_SIZE} batch-size=${BATCH_SIZE} dry-run=${DRY_RUN}`
)
if (RISK_TIER) {
  console.log(`[reconcile] risk-tier=${RISK_TIER}`)
}
if (SAMPLE_FILE) {
  console.log(`[reconcile] sample-file=${SAMPLE_FILE}`)
}
console.log(`[reconcile] model=${MODEL}  batch_id=${BATCH_ID}`)

// ── D1 helpers ──────────────────────────────────────────────────────────────
function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }
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

// ── Sample characters ───────────────────────────────────────────────────────
interface CharacterRow {
  id: string
  name: string
  category: string
  description: string | null
}

let characters: CharacterRow[]

if (SAMPLE_FILE) {
  interface SampleFilePayload {
    ids?: string[]
  }

  const payload = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8')) as SampleFilePayload
  const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => typeof id === 'string' && id.length > 0) : []

  if (ids.length === 0) {
    console.error(`[reconcile] sample file has no ids: ${SAMPLE_FILE}`)
    process.exit(2)
  }

  console.log(`[reconcile] sampling from file (${ids.length} ids) ...`)
  const idList = ids.map((id) => `'${id.replaceAll("'", "''")}'`).join(',')
  const rows = d1<CharacterRow>(
    `SELECT id, name, category, description
     FROM characters
     WHERE id IN (${idList})
       AND description IS NOT NULL
       AND length(description) > 20`
  )

  const byId = new Map(rows.map((row) => [row.id, row]))
  characters = ids.map((id) => byId.get(id)).filter((row): row is CharacterRow => row != null)
  console.log(`[reconcile]   loaded ${characters.length}/${ids.length} characters from sample file`)
} else {
  console.log(`[reconcile] sampling ${SAMPLE_SIZE} random characters ...`)
  characters = d1<CharacterRow>(
    `SELECT id, name, category, description
     FROM characters
     WHERE description IS NOT NULL AND length(description) > 20
     ORDER BY random()
     LIMIT ${SAMPLE_SIZE}`
  )
  console.log(`[reconcile]   sampled ${characters.length}`)
}

if (characters.length === 0) {
  console.log('[reconcile] no characters in catalog — exiting.')
  process.exit(0)
}

// ── Load stored attributes for those characters ─────────────────────────────
const ids = characters.map((c) => `'${c.id.replaceAll("'", "''")}'`).join(',')
console.log('[reconcile] loading stored character_attributes ...')
interface StoredAttrRow {
  character_id: string
  attribute_key: string
  value: number | null
}
const storedRows = d1<StoredAttrRow>(
  `SELECT character_id, attribute_key, value
   FROM character_attributes
   WHERE character_id IN (${ids})`
)
function intToValue(n: number | null): AttributeValue {
  if (n === 1) return 1
  if (n === 0) return 0
  return null
}

const storedByChar = new Map<string, AttributeMap>()
for (const r of storedRows) {
  let map = storedByChar.get(r.character_id)
  if (!map) {
    map = {}
    storedByChar.set(r.character_id, map)
  }
  map[r.attribute_key] = intToValue(r.value)
}
console.log(`[reconcile]   ${storedRows.length} stored values across ${storedByChar.size} chars`)

// ── Load attribute definitions (for category-aware prompt building) ─────────
const allAttrs: AttributeDef[] = loadAttributeDefinitions()
console.log(`[reconcile]   ${allAttrs.length} attribute definitions`)

function attrsForCategory(category: string): AttributeDef[] {
  return allAttrs.filter((a) => {
    if (!a.categories) return true
    try {
      const cats = JSON.parse(a.categories) as string[]
      return cats.includes(category)
    } catch {
      return true
    }
  })
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

async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<CallResult> {
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

// ── Main reconciliation loop ────────────────────────────────────────────────
function boolToValue(b: boolean | null): AttributeValue {
  if (b === true) return 1
  if (b === false) return 0
  return null
}

interface PerCharacterDrift {
  character: CharacterRow
  events: DriftEvent[]
}

const allDrift: PerCharacterDrift[] = []
let totalPromptTokens = 0
let totalCompletionTokens = 0

// Group characters by category so each batch shares the same attribute key set
const byCategory = new Map<string, CharacterRow[]>()
for (const c of characters) {
  const list = byCategory.get(c.category)
  if (list) list.push(c)
  else byCategory.set(c.category, [c])
}

for (const [category, chars] of byCategory) {
  const categoryAttrs = attrsForCategory(category)
  const attrKeySet = new Set(categoryAttrs.map((a) => a.key))
  const attrKeys = categoryAttrs.map((a) => a.key)
  console.log(
    `\n[reconcile] category=${category}  ${chars.length} chars  ${attrKeys.length} attrs/char`
  )

  for (let i = 0; i < chars.length; i += BATCH_SIZE) {
    const batch = chars.slice(i, i + BATCH_SIZE)
    const systemPrompt = buildSystemPrompt(attrKeys)
    const userPrompt = buildUserPrompt(batch)

    if (DRY_RUN) {
      console.log(
        `[reconcile]   batch ${i / BATCH_SIZE + 1}/${Math.ceil(chars.length / BATCH_SIZE)} (dry-run): would query ${batch.length} chars`
      )
      continue
    }

    let response: Record<string, Record<string, boolean | null>>
    try {
      const result = await callLLM(systemPrompt, userPrompt)
      response = result.parsed
      totalPromptTokens += result.promptTokens
      totalCompletionTokens += result.completionTokens
    } catch (err) {
      console.error(`[reconcile]   batch ${i / BATCH_SIZE + 1} FAILED: ${(err as Error).message}`)
      continue
    }

    for (const c of batch) {
      const fresh = response[c.id]
      if (!fresh) {
        console.warn(`[reconcile]   ${c.id} (${c.name}) — no entry in LLM response, skipping`)
        continue
      }
      const freshMap: AttributeMap = {}
      for (const [k, v] of Object.entries(fresh)) {
        if (!attrKeySet.has(k)) continue
        freshMap[k] = boolToValue(v)
      }
      const stored = storedByChar.get(c.id) ?? {}
      // Restrict comparison to keys this category cares about so we don't
      // emit "lost" events for global attrs the prompt didn't ask about.
      const events = computeDrift(stored, freshMap, {
        attributeAllowList: attrKeySet,
        emitDiscovered: true,
        emitLost: false,
      })
      if (events.length > 0) {
        allDrift.push({ character: c, events })
      }
    }

    console.log(
      `[reconcile]   batch ${i / BATCH_SIZE + 1}/${Math.ceil(chars.length / BATCH_SIZE)} done`
    )
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const flatEvents = allDrift.flatMap((d) => d.events)
const summary = summarizeDrift(flatEvents)
console.log(
  `\n[reconcile] complete: ${allDrift.length}/${characters.length} chars drifted, ${summary.total} events (${summary.contradictions} contradictions, ${summary.discovered} discovered, ${summary.lost} lost)`
)
console.log(`[reconcile] tokens: prompt=${totalPromptTokens} completion=${totalCompletionTokens}`)

if (allDrift.length > 0) {
  const top = [...allDrift].sort((a, b) => b.events.length - a.events.length).slice(0, 5)
  console.log('[reconcile] top drifted characters:')
  for (const d of top) {
    const s = summarizeDrift(d.events)
    console.log(
      `  ${d.character.id} (${d.character.name})  ${s.total} events  ${s.contradictions}c/${s.discovered}d`
    )
  }
}

if (flatEvents.length === 0) {
  console.log('[reconcile] no drift — exiting.')
  process.exit(0)
}

// ── Emit INSERT batch ───────────────────────────────────────────────────────
const batchIdSql = BATCH_ID.replaceAll("'", "''")
const headerLines = [
  '-- Generated by scripts/reconcile-attributes.ts (DQ.6)',
  `-- env=${ENV_FLAG} sample=${SAMPLE_SIZE} model=${MODEL}`,
  `-- risk_tier=${RISK_TIER || 'n/a'} sample_file=${SAMPLE_FILE || 'n/a'}`,
  `-- batch_id=${BATCH_ID}  events=${flatEvents.length}`,
  `-- generated_at=${new Date().toISOString()}`,
  '-- Note: no BEGIN TRANSACTION/COMMIT — D1 remote API rejects raw transaction control statements',
]
const sqlEscape = (s: string): string => s.replaceAll("'", "''")
const valueLit = (v: AttributeValue): string => (v === null ? 'NULL' : String(v))
const insertLines: string[] = []
for (const { character, events } of allDrift) {
  const charId = sqlEscape(character.id)
  for (const e of events) {
    insertLines.push(
      `INSERT INTO attribute_drift (character_id, attribute_key, old_value, new_value, source, batch_id, evidence) VALUES ('${charId}', '${sqlEscape(e.attributeKey)}', ${valueLit(e.oldValue)}, ${valueLit(e.newValue)}, 'reconcile-llm', '${batchIdSql}', 'model=${sqlEscape(MODEL)}');`
    )
  }
}
const lines = [...headerLines, ...insertLines]

const outFile = path.join(OUT_DIR, `drift-${ENV_FLAG}-${BATCH_ID.slice(0, 8)}.sql`)
writeFileSync(outFile, lines.join('\n'))
console.log(`[reconcile] wrote ${outFile} (${lines.length} lines)`)

if (DRY_RUN) {
  console.log('[reconcile] dry-run: skipping D1 write.')
  process.exit(0)
}

console.log('[reconcile] applying to D1 ...')
d1ApplyFile(outFile)
console.log('[reconcile] done.')
