#!/usr/bin/env npx tsx
/**
 * Wikidata SPARQL attribute enrichment (DQ.10).
 *
 * For every character ingested from Wikidata (source='wikidata'), queries the
 * Wikidata SPARQL endpoint for structured, human-curated facts and maps them
 * to boolean attribute keys. Writes results with confidence=0.95 (structured
 * source — no hallucination) and evidence='wikidata:sparql:<QID>:run=<iso>'.
 *
 * SPARQL-derivable attributes (from structured Wikidata properties):
 *   isHuman   — P31 (instance of) includes Q5 / Q15632617 / Q21070568 / Q18599272
 *   isFemale  — P21 (sex/gender) = Q6581072 / Q1052281, or P31 = Q18599272
 *   isMale    — P21 (sex/gender) = Q6581097 / Q2449503, or P31 = Q21070568
 *   isDeceased — P570 (date of death) exists
 *   isAnimal  — P31 includes Q729 / Q14624489
 *
 * Characters ingested from non-Wikidata sources (AniList, TMDb, IGDB,
 * ComicVine) are skipped — they don't have a Wikidata QID in source_id.
 *
 * Wikidata SPARQL public endpoint (no auth required):
 *   https://query.wikidata.org/sparql
 * Rate limit: ~5 req/s. Batches 50 QIDs per VALUES clause.
 *
 * Usage:
 *   npx tsx scripts/wikidata-enrich.ts
 *     [--env preview|production]
 *     [--limit 5000]     # max characters per run (default: 5000)
 *     [--batch-size 50]  # QIDs per SPARQL request (default: 50)
 *     [--dry-run]        # skip D1 write
 *
 * Designed for .github/workflows/wikidata-enrich.yml (weekly, Sunday 03:30 UTC).
 * No OpenAI key required — Wikidata SPARQL is free and public.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'wikidata-enrich')
const WRANGLER_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'wrangler')
mkdirSync(OUT_DIR, { recursive: true })

// ── Env loading ──────────────────────────────────────────────────────────────
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

// ── CLI args ─────────────────────────────────────────────────────────────────
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const ENV_FLAG = flag('--env', 'production')
const LIMIT = Number.parseInt(flag('--limit', '5000'), 10)
const BATCH_SIZE = Number.parseInt(flag('--batch-size', '50'), 10)
const DRY_RUN = process.argv.includes('--dry-run')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const RUN_ISO = new Date().toISOString()

// Confidence for structured SPARQL facts (highest tier — no hallucination).
const SPARQL_CONFIDENCE = 0.95

// Wikidata SPARQL endpoint (public, no auth required).
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
// Be a good citizen: 200ms between requests ≈ 5 req/s max.
const REQUEST_DELAY_MS = 200

console.log(
  `[wikidata-enrich] env=${ENV_FLAG} limit=${LIMIT} batch-size=${BATCH_SIZE} dry-run=${DRY_RUN}`,
)
console.log(`[wikidata-enrich] run=${RUN_ISO}`)

// ── Wikidata QID classification tables ───────────────────────────────────────
// P31 (instance of) QIDs that indicate a human (real or fictional).
const HUMAN_P31_IDS = new Set([
  'Q5',         // human
  'Q15632617',  // fictional human character
  'Q21070568',  // fictional male character
  'Q18599272',  // fictional female character
  'Q95074',     // fictional human (deprecated alias, still in use)
])

// P31 QIDs that indicate a female character via instance-of.
const FEMALE_P31_IDS = new Set(['Q18599272'])

// P31 QIDs that indicate a male character via instance-of.
const MALE_P31_IDS = new Set(['Q21070568'])

// P31 QIDs that indicate an animal.
const ANIMAL_P31_IDS = new Set([
  'Q729',       // animal
  'Q14624489',  // fictional animal character
  'Q55983715',  // fictional animal (broader)
])

// P21 (sex or gender) QIDs.
const FEMALE_GENDER_IDS = new Set(['Q6581072', 'Q1052281'])  // female, transgender female
const MALE_GENDER_IDS = new Set(['Q6581097', 'Q2449503'])    // male, transgender male

// ── SPARQL-derivable attribute keys ──────────────────────────────────────────
const SPARQL_ATTRS = ['isHuman', 'isFemale', 'isMale', 'isDeceased', 'isAnimal'] as const
type SparqlAttr = (typeof SPARQL_ATTRS)[number]
const SPARQL_ATTR_COUNT = SPARQL_ATTRS.length

// ── D1 helpers ───────────────────────────────────────────────────────────────
function d1<T>(sql: string): T[] {
  const out = execFileSync(
    WRANGLER_BIN,
    ['d1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 },
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(message: string): boolean {
  const n = message.toLowerCase()
  return [
    'internal error while starting up d1',
    'not currently importing',
    'etimedout',
    'econnreset',
    'fetch failed',
    'socket hang up',
    'service unavailable',
    'status code 503',
    'too many requests',
    'status code 429',
  ].some((m) => n.includes(m))
}

async function d1ApplyFile(filePath: string): Promise<void> {
  const maxAttempts = 4
  const baseDelayMs = 2000
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execFileSync(
        WRANGLER_BIN,
        ['d1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--file', filePath],
        { stdio: 'inherit' },
      )
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const canRetry = isRetryableError(message) && attempt < maxAttempts
      if (!canRetry) throw err
      const delay = baseDelayMs * 2 ** (attempt - 1)
      console.warn(
        `[wikidata-enrich] D1 apply transient failure (attempt ${attempt}/${maxAttempts}) — retrying in ${delay}ms`,
      )
      await sleep(delay)
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface CharRow {
  id: string
  name: string
  source_id: string  // The Wikidata QID, e.g. "Q76"
}

interface FilledCell {
  characterId: string
  attributeKey: string
  value: 0 | 1 | null
}

interface SparqlRow {
  item: { value: string }              // e.g. "http://www.wikidata.org/entity/Q76"
  p31s?: { value: string }             // pipe/comma-separated P31 entity URLs
  p21s?: { value: string }             // pipe/comma-separated P21 entity URLs
  deathDateCount?: { value: string }   // "0" or positive number
}

interface SparqlResponse {
  results: {
    bindings: SparqlRow[]
  }
}

// ── Load Wikidata characters from D1 ─────────────────────────────────────────
// Only characters where source='wikidata' have a Wikidata QID in source_id.
// Filter to those missing ≥1 SPARQL-derivable attribute.
const sparqlAttrList = SPARQL_ATTRS.map((k) => `'${k}'`).join(', ')

console.log(
  `[wikidata-enrich] querying up to ${LIMIT} Wikidata characters with incomplete SPARQL attrs ...`,
)
const candidates = d1<CharRow>(
  `SELECT c.id, c.name, c.source_id
   FROM characters c
   WHERE c.source = 'wikidata'
     AND c.source_id IS NOT NULL
     AND c.source_id LIKE 'Q%'
     AND (
       SELECT COUNT(DISTINCT ca.attribute_key)
       FROM character_attributes ca
       WHERE ca.character_id = c.id
         AND ca.attribute_key IN (${sparqlAttrList})
         AND ca.value IS NOT NULL
     ) < ${SPARQL_ATTR_COUNT}
   ORDER BY c.popularity DESC
   LIMIT ${LIMIT}`,
)
console.log(`[wikidata-enrich]   ${candidates.length} characters need SPARQL enrichment`)

if (candidates.length === 0) {
  console.log('[wikidata-enrich] all SPARQL-derivable attributes are filled — exiting.')
  process.exit(0)
}

// ── SPARQL query builder ──────────────────────────────────────────────────────
// Each request covers BATCH_SIZE QIDs using a SPARQL VALUES clause.
// Uses GROUP_CONCAT to aggregate multi-valued P31/P21 into a single row per character.
function buildSparqlQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(' ')
  return `
SELECT ?item
  (GROUP_CONCAT(DISTINCT STR(?p31Val); SEPARATOR=",") AS ?p31s)
  (GROUP_CONCAT(DISTINCT STR(?p21Val); SEPARATOR=",") AS ?p21s)
  (COUNT(?deathDate) AS ?deathDateCount)
WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P31 ?p31Val. }
  OPTIONAL { ?item wdt:P21 ?p21Val. }
  OPTIONAL { ?item wdt:P570 ?deathDate. }
}
GROUP BY ?item
`.trim()
}

// ── Extract QID from a Wikidata entity URL ────────────────────────────────────
function extractQid(url: string): string {
  return url.replace(/.*\//, '')
}

// ── Parse SPARQL row → attribute map ─────────────────────────────────────────
function parseSparqlRow(row: SparqlRow): Record<SparqlAttr, boolean | null> {
  const p31List = row.p31s?.value
    ? row.p31s.value.split(',').map(extractQid)
    : []
  const p21List = row.p21s?.value
    ? row.p21s.value.split(',').map(extractQid)
    : []
  const hasDeathDate = Number(row.deathDateCount?.value ?? '0') > 0

  const isHuman =
    p31List.length > 0
      ? p31List.some((q) => HUMAN_P31_IDS.has(q))
        ? true
        : false
      : null  // No P31 data — leave unknown

  const isAnimal =
    p31List.length > 0
      ? p31List.some((q) => ANIMAL_P31_IDS.has(q))
        ? true
        : false
      : null

  // isFemale: P21 gender value OR P31 fictional-female-character
  const hasFemaleGender = p21List.some((q) => FEMALE_GENDER_IDS.has(q))
  const hasFemaleP31 = p31List.some((q) => FEMALE_P31_IDS.has(q))
  const hasMaleGender = p21List.some((q) => MALE_GENDER_IDS.has(q))
  const hasMaleP31 = p31List.some((q) => MALE_P31_IDS.has(q))

  const isFemale =
    hasFemaleGender || hasFemaleP31
      ? true
      : hasMaleGender || hasMaleP31
        ? false
        : p21List.length > 0
          ? false  // Has a gender value but it's neither female nor male (non-binary, etc.)
          : null

  const isMale =
    hasMaleGender || hasMaleP31
      ? true
      : hasFemaleGender || hasFemaleP31
        ? false
        : p21List.length > 0
          ? false
          : null

  return {
    isHuman,
    isFemale,
    isMale,
    isDeceased: hasDeathDate ? true : null,  // null = no death record (could still be living)
    isAnimal,
  }
}

// ── SPARQL fetch ──────────────────────────────────────────────────────────────
async function fetchSparqlBatch(qids: string[]): Promise<Map<string, Record<SparqlAttr, boolean | null>>> {
  const query = buildSparqlQuery(qids)
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent':
        'GuessGame/1.0 (DQ.10 SPARQL enrichment; https://github.com/and3rn3t/guess)',
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw new Error(`SPARQL HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const data = (await res.json()) as SparqlResponse
  const out = new Map<string, Record<SparqlAttr, boolean | null>>()

  for (const row of data.results.bindings) {
    const qid = extractQid(row.item.value)
    out.set(qid, parseSparqlRow(row))
  }

  // Characters with no P31/P21/P570 data don't appear in SPARQL results.
  // Mark them with all-null so we don't re-query them every run.
  for (const qid of qids) {
    if (!out.has(qid)) {
      out.set(qid, {
        isHuman: null,
        isFemale: null,
        isMale: null,
        isDeceased: null,
        isAnimal: null,
      })
    }
  }

  return out
}

// ── SQL generation + D1 apply ─────────────────────────────────────────────────
const sqlEscape = (s: string): string => s.replaceAll("'", "''")
let flushCount = 0
const allFilled: FilledCell[] = []

async function flushAndApply(label: string): Promise<void> {
  if (allFilled.length === 0) return
  const cells = allFilled.splice(0, allFilled.length)
  const flushIdx = ++flushCount
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..*/, '')
  const outFile = path.join(
    OUT_DIR,
    `wikidata-${ENV_FLAG}-${stamp}-flush${flushIdx}.sql`,
  )

  const sqlLines = [
    `-- Generated by scripts/wikidata-enrich.ts (flush ${flushIdx}) — ${label}`,
    `-- env=${ENV_FLAG} run=${RUN_ISO}`,
    `-- confidence=${SPARQL_CONFIDENCE} (Wikidata SPARQL structured source)`,
    '-- No BEGIN TRANSACTION/COMMIT — D1 remote API rejects raw transaction control statements',
  ]

  const CHUNK = 200
  for (let i = 0; i < cells.length; i += CHUNK) {
    const chunk = cells.slice(i, i + CHUNK)
    sqlLines.push(
      'INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence, evidence) VALUES',
    )
    sqlLines.push(
      chunk
        .map((c) => {
          const ev = `wikidata:sparql:${c.characterId.replace('wikidata-', '')}:run=${RUN_ISO}`
          return `  ('${sqlEscape(c.characterId)}', '${sqlEscape(c.attributeKey)}', ${
            c.value === null ? 'NULL' : c.value
          }, ${c.value === null ? '0.50' : SPARQL_CONFIDENCE}, '${sqlEscape(ev)}')`
        })
        .join(',\n') + ';',
    )
  }

  writeFileSync(outFile, sqlLines.join('\n'))
  console.log(
    `[wikidata-enrich] flush #${flushIdx}: writing ${cells.length} cells → ${path.basename(outFile)}`,
  )
  if (!DRY_RUN) {
    await d1ApplyFile(outFile)
    console.log(`[wikidata-enrich] flush #${flushIdx}: applied to D1`)
  } else {
    console.log(`[wikidata-enrich] flush #${flushIdx}: dry-run, skipped D1 write`)
  }
}

// ── Main processing loop ──────────────────────────────────────────────────────
let processed = 0
let batchesQueried = 0
let sparqlErrors = 0

const startMs = Date.now()

for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
  const batch = candidates.slice(i, i + BATCH_SIZE)
  const qids = batch.map((c) => c.source_id)
  const batchLabel = `batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)}`

  if (DRY_RUN) {
    console.log(
      `[wikidata-enrich] ${batchLabel} (dry-run): would query ${qids.length} QIDs`,
    )
    for (const char of batch) {
      for (const attr of SPARQL_ATTRS) {
        allFilled.push({ characterId: char.id, attributeKey: attr, value: null })
      }
    }
    processed += batch.length
    batchesQueried++
  } else {
    try {
      const results = await fetchSparqlBatch(qids)
      batchesQueried++

      for (const char of batch) {
        const attrs = results.get(char.source_id)
        if (!attrs) continue
        for (const attr of SPARQL_ATTRS) {
          const v = attrs[attr]
          allFilled.push({
            characterId: char.id,
            attributeKey: attr,
            value: v === true ? 1 : v === false ? 0 : null,
          })
        }
      }

      processed += batch.length
      console.log(
        `[wikidata-enrich] ${batchLabel}: queried ${qids.length} QIDs → ${results.size} results`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[wikidata-enrich] ${batchLabel}: SPARQL error — ${msg.slice(0, 300)}`,
      )
      sparqlErrors++
      // Continue to next batch; don't abort entire run on a transient error.
    }

    // Rate-limit: be courteous to Wikidata's public endpoint.
    await sleep(REQUEST_DELAY_MS)
  }

  // Flush every 500 chars to preserve partial progress.
  if (allFilled.length >= 500) {
    await flushAndApply(batchLabel)
  }
}

// Final flush for any remaining cells.
await flushAndApply('final')

const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1)
console.log(`
[wikidata-enrich] SUMMARY
  characters : ${candidates.length}
  processed  : ${processed}
  batches    : ${batchesQueried}
  errors     : ${sparqlErrors}
  cells      : ${flushCount > 0 ? 'see SQL files' : '0 (all dry-run or no data)'}
  flushes    : ${flushCount}
  elapsed    : ${elapsedSec}s
  cost       : $0 (Wikidata SPARQL is free)
  dry-run    : ${DRY_RUN}
`)
