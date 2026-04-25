#!/usr/bin/env -S npx tsx
/**
 * Confusable character pair analysis.
 *
 * Identifies which characters are routinely confused with each other at guess
 * time (small probability gap between top-1 and top-2), and for each top-50
 * confusion pair finds the attributes that best discriminate them (one character
 * has true, the other has false for the same attribute).
 *
 * These discriminating attributes are stored per-character so that in the endgame,
 * the question selection engine can apply a ×1.4 boost to questions that directly
 * separate the top candidate from its most frequent confusers.
 *
 * Reads:  scripts/simulate/data/results-*.jsonl
 *         scripts/simulate/data/characters.json  (for attribute diffing)
 * Writes: scripts/simulate/data/confusion-discriminators.json
 *
 * Usage:
 *   npx tsx scripts/simulate/confusion-pairs.ts
 *   npx tsx scripts/simulate/confusion-pairs.ts --gap-threshold 0.25  # looser close-call def
 *   npx tsx scripts/simulate/confusion-pairs.ts --top-pairs 100       # more pairs to analyze
 *   npx tsx scripts/simulate/confusion-pairs.ts --top-attrs 10        # attrs per character
 *
 * Output format: Record<string, string[]>  (characterId → discriminating attribute list)
 * Store in KV:   wrangler kv key put --binding GUESS_KV "kv:confusion-discriminators" <json>
 */

import { createReadStream, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')

// ── CLI args ──────────────────────────────────────────────────────────────────

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null
}

/** Max probability gap between top-1 and top-2 to count as a "close call" */
const GAP_THRESHOLD = arg('gap-threshold') ? parseFloat(arg('gap-threshold')!) : 0.20
/** Top N most-confused pairs to analyze */
const TOP_PAIRS = arg('top-pairs') ? parseInt(arg('top-pairs')!, 10) : 50
/** Number of discriminating attributes to store per character */
const TOP_ATTRS = arg('top-attrs') ? parseInt(arg('top-attrs')!, 10) : 8
const INPUT_FILE = arg('input')
const OUTPUT_FILE = arg('output') ?? join(DATA_DIR, 'confusion-discriminators.json')

// ── Load character pool ───────────────────────────────────────────────────────

const characterPath = join(DATA_DIR, 'characters.json')
if (!existsSync(characterPath)) {
  console.error(`characters.json not found at ${characterPath}\nRun 'pnpm simulate:export' first.`)
  process.exit(1)
}

const allCharacters: Array<{ id: string; name: string; attributes: Record<string, boolean | null> }> =
  JSON.parse(readFileSync(characterPath, 'utf8'))
const characterMap = new Map(allCharacters.map((c) => [c.id, c]))
console.log(`Loaded ${allCharacters.length} characters`)

// ── Locate JSONL files ────────────────────────────────────────────────────────

let jsonlFiles: string[]
if (INPUT_FILE) {
  const resolved = INPUT_FILE.startsWith('/') ? INPUT_FILE : join(DATA_DIR, INPUT_FILE)
  if (!existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }
  jsonlFiles = [resolved]
} else {
  if (!existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}\nRun 'pnpm simulate:run' first.`)
    process.exit(1)
  }
  jsonlFiles = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(DATA_DIR, f))
  if (jsonlFiles.length === 0) {
    console.error('No .jsonl files found in data/. Run `pnpm simulate:run` first.')
    process.exit(1)
  }
}

console.log(`Reading ${jsonlFiles.length} JSONL file(s)...`)

// ── Accumulate confusion pairs ────────────────────────────────────────────────

/** key = "characterA__characterB" (sorted alphabetically to deduplicate) */
const pairConfusion = new Map<string, number>()
/** Track which character was the target to build per-character confusion lists */
const targetConfusion = new Map<string, Map<string, number>>()

async function processFile(filePath: string): Promise<number> {
  let lines = 0
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const record = JSON.parse(trimmed) as {
        targetCharacterId: string
        secondBestCharacterId: string | null
        gapAtGuess: number | null
        won: boolean
      }

      // Only count close calls (small gap between top-1 and top-2)
      if (
        !record.secondBestCharacterId ||
        record.gapAtGuess === null ||
        record.gapAtGuess >= GAP_THRESHOLD
      ) {
        lines++
        continue
      }

      const targetId = record.targetCharacterId
      const confuserId = record.secondBestCharacterId

      // Symmetric pair key for global frequency
      const [a, b] = [targetId, confuserId].sort()
      const pairKey = `${a}__${b}`
      pairConfusion.set(pairKey, (pairConfusion.get(pairKey) ?? 0) + 1)

      // Per-target confusion (asymmetric — we want discriminators for the target)
      let targetMap = targetConfusion.get(targetId)
      if (!targetMap) {
        targetMap = new Map()
        targetConfusion.set(targetId, targetMap)
      }
      targetMap.set(confuserId, (targetMap.get(confuserId) ?? 0) + 1)

      lines++
    } catch {
      // skip malformed lines
    }
  }
  return lines
}

let totalGames = 0
for (const f of jsonlFiles) {
  const count = await processFile(f)
  totalGames += count
  console.log(`  ${f}: ${count} games`)
}
console.log(`Total: ${totalGames} games`)

// ── Select top confusion pairs ────────────────────────────────────────────────

const sortedPairs = Array.from(pairConfusion.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, TOP_PAIRS)

console.log(`\nTop ${Math.min(TOP_PAIRS, sortedPairs.length)} confusion pairs (gap < ${GAP_THRESHOLD}):`)
for (const [pairKey, count] of sortedPairs.slice(0, 20)) {
  const [idA, idB] = pairKey.split('__') as [string, string]
  const nameA = characterMap.get(idA)?.name ?? idA
  const nameB = characterMap.get(idB)?.name ?? idB
  console.log(`  ${nameA} ↔ ${nameB}: ${count} close calls`)
}

// ── Find discriminating attributes for each character ────────────────────────

/**
 * For two characters A and B, find attributes where their values differ:
 * - A has true, B has false → this attribute separates them (ask "yes/no" about A)
 * - A has false, B has true → same
 * - One or both null → not useful for discrimination
 */
function findDiscriminators(
  targetId: string,
  confuserId: string
): string[] {
  const target = characterMap.get(targetId)
  const confuser = characterMap.get(confuserId)
  if (!target || !confuser) return []

  const discriminators: string[] = []
  // Union of all attributes from both characters
  const allAttrs = new Set([
    ...Object.keys(target.attributes),
    ...Object.keys(confuser.attributes),
  ])

  for (const attr of allAttrs) {
    const tVal = target.attributes[attr] ?? null
    const cVal = confuser.attributes[attr] ?? null
    // Only count as discriminating when both values are known and differ
    if (tVal !== null && cVal !== null && tVal !== cVal) {
      discriminators.push(attr)
    }
  }

  return discriminators
}

// Build per-character discriminator lists, weighted by confusion frequency
const characterDiscriminators = new Map<string, Map<string, number>>()

for (const [targetId, confuserMap] of targetConfusion) {
  // Sort confusers by frequency (most-confused first)
  const sortedConfusers = Array.from(confuserMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)  // top-10 confusers per target

  for (const [confuserId, freq] of sortedConfusers) {
    const discriminators = findDiscriminators(targetId, confuserId)
    let attrMap = characterDiscriminators.get(targetId)
    if (!attrMap) {
      attrMap = new Map()
      characterDiscriminators.set(targetId, attrMap)
    }
    // Accumulate weighted score: more frequent confusion = higher weight
    for (const attr of discriminators) {
      attrMap.set(attr, (attrMap.get(attr) ?? 0) + freq)
    }
  }
}

// ── Build output: top-N discriminating attributes per character ───────────────

const output: Record<string, string[]> = {}
for (const [charId, attrMap] of characterDiscriminators) {
  const sorted = Array.from(attrMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ATTRS)
    .map(([attr]) => attr)
  if (sorted.length > 0) {
    output[charId] = sorted
  }
}

console.log(`\nBuilt discriminator lists for ${Object.keys(output).length} characters`)

// Sample output for a few high-confusion characters
const topConfusedChars = Array.from(targetConfusion.entries())
  .sort((a, b) => {
    const totalA = Array.from(a[1].values()).reduce((s, v) => s + v, 0)
    const totalB = Array.from(b[1].values()).reduce((s, v) => s + v, 0)
    return totalB - totalA
  })
  .slice(0, 5)

console.log(`\nSample discriminators for most-confused characters:`)
for (const [charId] of topConfusedChars) {
  const name = characterMap.get(charId)?.name ?? charId
  const attrs = output[charId] ?? []
  console.log(`  ${name}: ${attrs.slice(0, 5).join(', ')}`)
}

// ── Write output ──────────────────────────────────────────────────────────────

writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
console.log(`\nWrote discriminators for ${Object.keys(output).length} characters to: ${OUTPUT_FILE}`)
console.log(`\nTo upload to KV (production):`)
console.log(`  cat "${OUTPUT_FILE}" | npx wrangler kv key put --binding GUESS_KV "kv:confusion-discriminators" --stdin --env production`)
