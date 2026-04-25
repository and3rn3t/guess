#!/usr/bin/env -S npx tsx
/**
 * Compute per-attribute maybe-answer rates from simulation JSONL data.
 *
 * The global MAYBE_ANSWER_PROB = 0.15 constant is a universal prior. In practice,
 * subjective attributes (isFunny, isEvil) get far more "maybe" answers than binary
 * attributes (isHuman, canFly). Using per-attribute rates in the 3-way entropy
 * calculation produces more accurate expected information gain estimates.
 *
 * Reads:  scripts/simulate/data/results-*.jsonl  (output from `pnpm simulate:run`)
 * Writes: scripts/simulate/data/maybe-rates.json
 *
 * Usage:
 *   npx tsx scripts/simulate/export-maybe-rates.ts
 *   npx tsx scripts/simulate/export-maybe-rates.ts --input results-medium.jsonl
 *   npx tsx scripts/simulate/export-maybe-rates.ts --min-samples 50  # require ≥50 samples
 *
 * Output format: Record<string, number>  (attribute → maybe rate 0–1)
 * Store in KV:   wrangler kv key put --binding GUESS_KV "kv:attribute-maybe-rates" <json>
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
const OUTPUT_FILE = arg('output') ?? join(DATA_DIR, 'maybe-rates.json')

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
  yes: number
  no: number
  maybe: number
  // 'unknown' answers provide no signal — excluded from maybe-rate denominator
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
        const answer = step.answer as 'yes' | 'no' | 'maybe' | 'unknown'
        if (answer === 'unknown') continue  // no signal
        let s = stats.get(step.attribute)
        if (!s) {
          s = { yes: 0, no: 0, maybe: 0 }
          stats.set(step.attribute, s)
        }
        if (answer === 'yes') s.yes++
        else if (answer === 'no') s.no++
        else if (answer === 'maybe') s.maybe++
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

// ── Compute maybe rates ───────────────────────────────────────────────────────

const maybeRates: Record<string, number> = {}
let retained = 0
let skipped = 0

for (const [attr, s] of stats) {
  const total = s.yes + s.no + s.maybe
  if (total < MIN_SAMPLES) {
    skipped++
    continue
  }
  maybeRates[attr] = s.maybe / total
  retained++
}

console.log(`\nRetained: ${retained} attributes (≥${MIN_SAMPLES} samples)`)
console.log(`Skipped:  ${skipped} attributes (insufficient samples — will use global default)`)

// ── Summary stats ─────────────────────────────────────────────────────────────

const rates = Object.values(maybeRates)
if (rates.length > 0) {
  const sorted = rates.slice().sort((a, b) => b - a)
  const mean = rates.reduce((s, v) => s + v, 0) / rates.length
  console.log(`\nMaybe rate distribution:`)
  console.log(`  Global default (MAYBE_ANSWER_PROB): 0.150`)
  console.log(`  Mean across attributes:             ${mean.toFixed(3)}`)
  console.log(`  Max (most subjective):              ${sorted[0]!.toFixed(3)}`)
  console.log(`  Min (most binary):                  ${sorted[sorted.length - 1]!.toFixed(3)}`)

  const highMaybe = Object.entries(maybeRates)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  console.log(`\nTop 10 highest maybe rates (most subjective):`)
  for (const [attr, rate] of highMaybe) {
    const s = stats.get(attr)!
    console.log(`  ${attr.padEnd(40)} ${(rate * 100).toFixed(1)}%  (n=${s.yes + s.no + s.maybe})`)
  }

  const lowMaybe = Object.entries(maybeRates)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
  console.log(`\nTop 10 lowest maybe rates (most binary):`)
  for (const [attr, rate] of lowMaybe) {
    const s = stats.get(attr)!
    console.log(`  ${attr.padEnd(40)} ${(rate * 100).toFixed(1)}%  (n=${s.yes + s.no + s.maybe})`)
  }
}

// ── Write output ──────────────────────────────────────────────────────────────

writeFileSync(OUTPUT_FILE, JSON.stringify(maybeRates, null, 2))
console.log(`\nWrote ${retained} attribute rates to: ${OUTPUT_FILE}`)
console.log(`\nTo upload to KV (production):`)
console.log(`  cat "${OUTPUT_FILE}" | npx wrangler kv key put --binding GUESS_KV "kv:attribute-maybe-rates" --stdin --env production`)
