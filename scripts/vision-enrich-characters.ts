#!/usr/bin/env npx tsx
/**
 * Vision-derived attribute enrichment (DQ.2 bulk).
 *
 * Processes characters with `image_url` that have NULL values for visual
 * boolean attributes, runs each image through a vision LLM, and writes
 * the results back to `character_attributes` with provenance tag
 * `vision:openai:<model>:run=<iso>` (DQ.28 convention).
 *
 * Visual attributes handled:
 *   wearsCape, wearsGlasses, wearsHat, wearsMask, hasBeard, hasFacialHair,
 *   hasGlasses, hasLongHair, hasShortHair, hasBlondeHair, hasRedHair,
 *   hasBlueEyes, hasGreenEyes, hasArmor, hasClaws, hasTail, hasWings,
 *   hasScar, hasTattoos, isBald, isFemale, isMale, isAlien, isRobot, isCyborg.
 *
 * These are attributes that text-only enrichment extracts from character
 * descriptions with high error rates. A vision model assessing the image
 * directly produces ground-truth quality for appearance attributes.
 *
 * Confidence written: 0.88 (vision-derived, image-quality dependent).
 * Evidence tag: vision:openai:<model>:run=<iso>
 *
 * Usage:
 *   npx tsx scripts/vision-enrich-characters.ts
 *     [--env preview|production]
 *     [--limit 300]         # max characters per run (default: 300)
 *     [--concurrency 5]     # parallel vision calls (default: 5)
 *     [--flush-every 25]    # apply to D1 every N chars (default: 25)
 *     [--dry-run]           # skip OpenAI + D1 write
 *
 * Designed for .github/workflows/vision-enrich-nightly.yml.
 * Lives in GH Actions (not CF Worker) because the OpenAI key is not wired
 * into the Worker environment and vision calls require extended wall-clock time.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from './ingest/rate-limiter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'vision-enrich')
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
const LIMIT = Number.parseInt(flag('--limit', '300'), 10)
const CONCURRENCY = Number.parseInt(flag('--concurrency', '5'), 10)
const FLUSH_EVERY = Number.parseInt(flag('--flush-every', '25'), 10)
const DRY_RUN = process.argv.includes('--dry-run')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const MODEL = process.env.VISION_MODEL?.trim() || 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const RUN_ISO = new Date().toISOString()

// Confidence assigned to vision-derived values (image-quality-dependent).
const VISION_CONFIDENCE = 0.88

console.log(
  `[vision-enrich] env=${ENV_FLAG} limit=${LIMIT} concurrency=${CONCURRENCY} flush-every=${FLUSH_EVERY} dry-run=${DRY_RUN}`,
)
console.log(`[vision-enrich] model=${MODEL}  run=${RUN_ISO}`)

// ── Visual attribute keys (must exist in attribute_definitions) ───────────────
// These are the attributes a vision model can assess from a character image.
// Mirrors VISION_TARGET_ATTRS in scripts/vision-validate.ts — keep in sync.
const VISION_TARGET_ATTRS = [
  'wearsCape',
  'wearsGlasses',
  'wearsHat',
  'wearsMask',
  'hasBeard',
  'hasFacialHair',
  'hasGlasses',
  'hasLongHair',
  'hasShortHair',
  'hasBlondeHair',
  'hasRedHair',
  'hasBlueEyes',
  'hasGreenEyes',
  'hasArmor',
  'hasClaws',
  'hasTail',
  'hasWings',
  'hasScar',
  'hasTattoos',
  'isBald',
  'isFemale',
  'isMale',
  'isAlien',
  'isRobot',
  'isCyborg',
] as const

type VisionAttr = (typeof VISION_TARGET_ATTRS)[number]
const VISUAL_ATTR_COUNT = VISION_TARGET_ATTRS.length

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
        `[vision-enrich] D1 apply transient failure (attempt ${attempt}/${maxAttempts}) — retrying in ${delay}ms`,
      )
      await sleep(delay)
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface CharRow {
  id: string
  name: string
  image_url: string
}

interface FilledCell {
  characterId: string
  attributeKey: string
  value: 0 | 1 | null
}

interface OpenAIVisionResponse {
  choices: Array<{ message: { content: string } }>
}

// ── Load candidate characters from D1 ────────────────────────────────────────
// Find characters with an image_url that are missing ≥1 visual attribute
// value (either no row or NULL value in character_attributes).
const visualAttrList = VISION_TARGET_ATTRS.map((k) => `'${k}'`).join(', ')

console.log(
  `[vision-enrich] querying up to ${LIMIT} characters with incomplete visual attrs ...`,
)
const candidates = d1<CharRow>(
  `SELECT c.id, c.name, c.image_url
   FROM characters c
   WHERE c.image_url IS NOT NULL
     AND (
       SELECT COUNT(DISTINCT ca.attribute_key)
       FROM character_attributes ca
       WHERE ca.character_id = c.id
         AND ca.attribute_key IN (${visualAttrList})
         AND ca.value IS NOT NULL
     ) < ${VISUAL_ATTR_COUNT}
   ORDER BY c.popularity DESC
   LIMIT ${LIMIT}`,
)
console.log(`[vision-enrich]   ${candidates.length} characters need visual enrichment`)

if (candidates.length === 0) {
  console.log('[vision-enrich] all visual attributes are filled — exiting.')
  process.exit(0)
}

// ── Vision model prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `You are a careful visual classifier of fictional characters.

You will be shown ONE image of a character. Look at the image and answer each boolean attribute strictly based on what is visible in the image. If the image clearly shows it, answer true. If the image clearly shows it is absent, answer false. If you genuinely cannot tell from the image alone, answer null.

Rules:
- Answer based on visual evidence in the image only — do not use prior knowledge of the character.
- "wearsHat" = a hat or helmet covering the top of the head is visible.
- "wearsCape" = a cape is visible behind the character.
- "wearsMask" = the face is partially or fully covered by a costume mask (not just shadows).
- "wearsGlasses" / "hasGlasses" = visible glasses or goggles on the eyes (treat as the same answer).
- "hasBeard" = a beard is clearly visible. "hasFacialHair" = any facial hair (beard, moustache, stubble).
- "hasLongHair" = hair clearly past the shoulders. "hasShortHair" = hair clearly above the shoulders. "isBald" = no visible hair on the scalp.
- "hasBlondeHair" / "hasRedHair" = hair color is clearly that color.
- "hasBlueEyes" / "hasGreenEyes" = eye color is clearly that color (null if eyes not visible).
- "hasArmor" = visible plate / hard armor on the body.
- "hasClaws" = pointed claws on hands.
- "hasTail" = a tail is visible.
- "hasWings" = wings are visible.
- "hasScar" = a scar is visible on visible skin.
- "hasTattoos" = tattoos are visible on visible skin.
- "isFemale" / "isMale" = apparent gender presentation in the image (one true, the other false; null only if truly unclear).
- "isAlien" = the figure is clearly non-human in appearance (e.g. green skin, antennae, non-human anatomy).
- "isRobot" = the figure is clearly mechanical / metallic / robotic.
- "isCyborg" = visible mix of organic and mechanical parts.

Return STRICT JSON exactly matching this shape:
{
${VISION_TARGET_ATTRS.map((k) => `  "${k}": true | false | null`).join(',\n')}
}
No prose, no markdown.`
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'GuessGame/1.0 (DQ.2 vision enrichment; https://github.com/and3rn3t/guess)',
      Accept: 'image/*',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Image fetch HTTP ${res.status} for ${imageUrl}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') ?? 'image/jpeg'
  return `data:${ct};base64,${buf.toString('base64')}`
}

async function callVisionModel(
  apiKey: string,
  imageDataUrl: string,
  characterName: string,
): Promise<Record<VisionAttr, boolean | null>> {
  const res = await withRetry(
    () =>
      fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Classify the visible appearance of this character (name shown only as a hint; answer based on the image): ${characterName}`,
                },
                { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
              ],
            },
          ],
        }),
      }).then((r) => {
        if (r.status === 429 || r.status >= 500) {
          return r.text().then((body) => {
            throw new Error(`OpenAI ${r.status}: ${body.slice(0, 300)}`)
          })
        }
        return r
      }),
    3,
    2000,
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI vision error ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as OpenAIVisionResponse
  const content = data.choices[0]?.message?.content?.trim() ?? ''
  const parsed = JSON.parse(content) as Record<string, boolean | null>

  const out = {} as Record<VisionAttr, boolean | null>
  for (const k of VISION_TARGET_ATTRS) {
    const v = parsed[k]
    out[k] = v === true || v === false ? v : null
  }
  return out
}

// ── SQL generation + D1 apply ─────────────────────────────────────────────────
const sqlEscape = (s: string): string => s.replaceAll("'", "''")
const evidence = `vision:openai:${MODEL}:run=${RUN_ISO}`
let flushCount = 0
const allFilled: FilledCell[] = []

async function flushAndApply(label: string): Promise<void> {
  if (allFilled.length === 0) return
  const cells = allFilled.splice(0, allFilled.length)
  const flushIdx = ++flushCount
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..*/, '')
  const outFile = path.join(OUT_DIR, `vision-${ENV_FLAG}-${stamp}-flush${flushIdx}.sql`)

  const sqlLines = [
    `-- Generated by scripts/vision-enrich-characters.ts (flush ${flushIdx}) — ${label}`,
    `-- env=${ENV_FLAG} model=${MODEL} run=${RUN_ISO}`,
    `-- confidence=${VISION_CONFIDENCE} (vision-derived)`,
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
        .map(
          (c) =>
            `  ('${sqlEscape(c.characterId)}', '${sqlEscape(c.attributeKey)}', ${
              c.value === null ? 'NULL' : c.value
            }, ${c.value === null ? '0.65' : VISION_CONFIDENCE}, '${sqlEscape(evidence)}')`,
        )
        .join(',\n') + ';',
    )
  }

  writeFileSync(outFile, sqlLines.join('\n'))
  console.log(
    `[vision-enrich] flush #${flushIdx}: writing ${cells.length} cells → ${path.basename(outFile)}`,
  )
  if (!DRY_RUN) {
    await d1ApplyFile(outFile)
    console.log(`[vision-enrich] flush #${flushIdx}: applied to D1`)
  } else {
    console.log(`[vision-enrich] flush #${flushIdx}: dry-run, skipped D1 write`)
  }
}

// ── Worker pool ───────────────────────────────────────────────────────────────
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey && !DRY_RUN) {
  console.error(
    '[vision-enrich] OPENAI_API_KEY not set — pass --dry-run to skip vision calls.',
  )
  process.exit(3)
}

let processed = 0
let succeeded = 0
let failed = 0
let charIdx = 0

async function processOne(char: CharRow, label: string): Promise<void> {
  if (DRY_RUN) {
    console.log(
      `[vision-enrich] ${label} (dry-run): would classify ${char.id} (${char.name})`,
    )
    for (const attr of VISION_TARGET_ATTRS) {
      allFilled.push({ characterId: char.id, attributeKey: attr, value: null })
    }
    processed++
    succeeded++
    return
  }

  try {
    const dataUrl = await fetchImageAsDataUrl(char.image_url)
    const attrs = await callVisionModel(apiKey!, dataUrl, char.name)
    for (const attr of VISION_TARGET_ATTRS) {
      const v = attrs[attr]
      allFilled.push({
        characterId: char.id,
        attributeKey: attr,
        value: v === true ? 1 : v === false ? 0 : null,
      })
    }
    console.log(`[vision-enrich] ${label} ok — ${char.id} (${char.name})`)
    succeeded++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[vision-enrich] ${label} error — ${char.id} (${char.name}): ${msg.slice(0, 200)}`)
    failed++
  }
  processed++
}

async function runWorkerPool(): Promise<void> {
  async function worker(): Promise<void> {
    while (true) {
      const idx = charIdx++
      if (idx >= candidates.length) break
      const char = candidates[idx]!
      const label = `char ${idx + 1}/${candidates.length}`
      await processOne(char, label)
      if (processed % FLUSH_EVERY === 0) {
        await flushAndApply(`after char ${processed}`)
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () =>
    worker(),
  )
  await Promise.all(workers)
  // Final flush for any remaining cells
  await flushAndApply('final')
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(
  `\n[vision-enrich] processing ${candidates.length} characters (concurrency=${CONCURRENCY}) ...`,
)
const startMs = Date.now()

await runWorkerPool()

const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1)
const cost = (succeeded * VISION_TARGET_ATTRS.length * 0.00015).toFixed(4) // rough gpt-4o-mini vision estimate
console.log(`
[vision-enrich] SUMMARY
  processed  : ${processed}
  succeeded  : ${succeeded}
  failed     : ${failed}
  cells      : ${succeeded * VISION_TARGET_ATTRS.length} (${VISION_TARGET_ATTRS.length} attrs × ${succeeded} chars)
  flushes    : ${flushCount}
  elapsed    : ${elapsedSec}s
  est. cost  : ~$${cost}
  dry-run    : ${DRY_RUN}
`)
