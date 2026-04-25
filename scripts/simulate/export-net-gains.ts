#!/usr/bin/env -S npx tsx
/**
 * Compute per-attribute net information gain from simulation JSONL data.
 *
 * Net gain = avgInfoGain × (1 − unknownRate)
 *
 * This metric penalises attributes that consistently elicit 'unknown' answers
 * (data gaps in the character pool), since they add no information despite
 * appearing to have high information gain in theory. Questions below the
 * net-gain floor (NET_GAIN_FLOOR = 0.05 by default) are filtered from the
 * scoring pool at runtime when better alternatives exist.
 *
 * Reads:  scripts/simulate/data/results-*.jsonl
 * Writes: scripts/simulate/data/net-gains.json
 *
 * Usage:
 *   npx tsx scripts/simulate/export-net-gains.ts
 *   npx tsx scripts/simulate/export-net-gains.ts --input results-medium.jsonl
 *   npx tsx scripts/simulate/export-net-gains.ts --min-samples 30
 *
 * Output format: Record<string, number>  (attribute → net gain 0–1, normalized)
 * Store in KV:   wrangler kv key put --binding GUESS_KV "kv:attribute-net-gains" <json>
 */

import { createReadStream, writeFileSync, readdirSync, existsSync } from 'node:fs'
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

const MIN_SAMPLES = arg('min-samples') ? parseInt(arg('min-samples')!, 10) : 20
const INPUT_FILE = arg('input')
const OUTPUT_FILE = arg('output') ?? join(DATA_DIR, 'net-gains.json')

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

// ── Accumulator ───────────────────────────────────────────────────────────────

interface AttributeStats {
  totalGain: number
  count: number
  unknownCount: number
}

const stats = new Map<string, AttributeStats>()

async function processFile(filePath: string): Promise<number> {
  let lines = 0
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const record = JSON.parse(trimmed) as {
        questionsSequence: Array<{ attribute: string; answer: string; infoGain: number }>
      }
      for (const step of record.questionsSequence ?? []) {
        if (!step.attribute) continue
        let s = stats.get(step.attribute)
        if (!s) {
          s = { totalGain: 0, count: 0, unknownCount: 0 }
          stats.set(step.attribute, s)
        }
        s.totalGain += step.infoGain
        s.count++
        if (step.answer === 'unknown') s.unknownCount++
      }
      lines++
    } catch {
      // skip malformed lines
    }
  }
  return lines
}

// ── Process all files ─────────────────────────────────────────────────────────

let totalGames = 0
for (const f of jsonlFiles) {
  const count = await processFile(f)
  totalGames += count
  console.log(`  ${f}: ${count} games`)
}
console.log(`Total: ${totalGames} games, ${stats.size} unique attributes`)

// ── Compute raw net gain per attribute ────────────────────────────────────────

interface RawGain {
  attribute: string
  avgGain: number
  unknownRate: number
  netGain: number
  count: number
}

const rawGains: RawGain[] = []
let skipped = 0

for (const [attr, s] of stats) {
  if (s.count < MIN_SAMPLES) {
    skipped++
    continue
  }
  const avgGain = s.totalGain / s.count
  const unknownRate = s.unknownCount / s.count
  rawGains.push({ attribute: attr, avgGain, unknownRate, netGain: avgGain * (1 - unknownRate), count: s.count })
}

rawGains.sort((a, b) => b.netGain - a.netGain)

console.log(`\nRetained: ${rawGains.length} attributes (≥${MIN_SAMPLES} samples)`)
console.log(`Skipped:  ${skipped} attributes (insufficient samples — all will pass through)`)

// ── Normalize 0–1 ─────────────────────────────────────────────────────────────

const maxNetGain = rawGains[0]?.netGain ?? 1
const netGains: Record<string, number> = {}
for (const { attribute, netGain } of rawGains) {
  netGains[attribute] = maxNetGain > 0 ? netGain / maxNetGain : 1
}

// ── Summary ───────────────────────────────────────────────────────────────────

const NET_GAIN_FLOOR = 0.05
const belowFloor = rawGains.filter((r) => netGains[r.attribute]! < NET_GAIN_FLOOR)
console.log(`\nAttributes below default floor (${NET_GAIN_FLOOR}): ${belowFloor.length} would be filtered`)

console.log(`\nTop 15 by net gain (most informative):`)
for (const r of rawGains.slice(0, 15)) {
  const normalized = netGains[r.attribute]!
  console.log(
    `  ${r.attribute.padEnd(40)} ng=${normalized.toFixed(3)}  ` +
    `avgGain=${r.avgGain.toFixed(3)}  unknownRate=${(r.unknownRate * 100).toFixed(0)}%  n=${r.count}`
  )
}

console.log(`\nBottom 15 by net gain (least informative):`)
for (const r of rawGains.slice(-15).reverse()) {
  const normalized = netGains[r.attribute]!
  const flag = normalized < NET_GAIN_FLOOR ? ' ← FILTERED' : ''
  console.log(
    `  ${r.attribute.padEnd(40)} ng=${normalized.toFixed(3)}  ` +
    `avgGain=${r.avgGain.toFixed(3)}  unknownRate=${(r.unknownRate * 100).toFixed(0)}%  n=${r.count}${flag}`
  )
}

// ── Write output ──────────────────────────────────────────────────────────────

writeFileSync(OUTPUT_FILE, JSON.stringify(netGains, null, 2))
console.log(`\nWrote ${rawGains.length} attribute net gains to: ${OUTPUT_FILE}`)
console.log(`\nTo upload to KV (production):`)
console.log(`  cat "${OUTPUT_FILE}" | npx wrangler kv key put --binding GUESS_KV "kv:attribute-net-gains" --stdin --env production`)
