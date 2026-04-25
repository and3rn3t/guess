/**
 * Export character and question data from D1 for local simulation.
 *
 * Usage:
 *   pnpm simulate:export                   # export from production
 *   pnpm simulate:export --env preview     # export from preview
 *
 * Output:
 *   scripts/simulate/data/characters.json
 *   scripts/simulate/data/questions.json
 */

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const envIdx = args.indexOf('--env')
const env: string = envIdx !== -1 ? (args[envIdx + 1] ?? 'production') : 'production'

const DB_NAME = env === 'production' ? 'guess-db' : 'guess-db-preview'
const ENV_FLAG = env === 'production' ? '--env production' : '--env preview'

console.log(`Exporting from ${DB_NAME} (${env})...`)

// ── Helpers ───────────────────────────────────────────────────────────────────

function d1Query(sql: string): unknown[] {
  const escaped = sql.replace(/"/g, '\\"')
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --remote --command "${escaped}" --json`
  const raw = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024 })
  // wrangler returns an array of result sets; take the first results
  const parsed = JSON.parse(raw) as Array<{ results?: unknown[] }>
  return parsed[0]?.results ?? []
}

// ── Parse attributes_json column (mirrors start.ts parseAttrsJson) ────────────

function parseAttrsJson(json: string): Record<string, boolean | null> {
  try {
    const raw = JSON.parse(json) as Record<string, number>
    const result: Record<string, boolean | null> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (val === 1) result[key] = true
      else if (val === 0) result[key] = false
      else result[key] = null
    }
    return result
  } catch {
    return {}
  }
}

// ── Export characters ─────────────────────────────────────────────────────────

console.log('Fetching characters...')
const MIN_ATTRIBUTES = 20
const characterRows = d1Query(
  `SELECT id, name, category, popularity, attributes_json FROM characters WHERE attributes_json IS NOT NULL AND attribute_count >= ${MIN_ATTRIBUTES} ORDER BY popularity DESC`
) as Array<{ id: string; name: string; category: string; popularity: number | null; attributes_json: string }>

const characters = characterRows.map((row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  popularity: row.popularity ?? 0,
  attributes: parseAttrsJson(row.attributes_json),
}))

console.log(`  → ${characters.length} characters`)

// ── Export questions ──────────────────────────────────────────────────────────

console.log('Fetching questions...')
const questionRows = d1Query(
  'SELECT id, text, attribute_key FROM questions ORDER BY priority DESC'
) as Array<{ id: string; text: string; attribute_key: string }>

const questions = questionRows.map((row) => ({
  id: row.id,
  text: row.text,
  attribute: row.attribute_key,
}))

console.log(`  → ${questions.length} questions`)

// ── Write output ──────────────────────────────────────────────────────────────

mkdirSync(DATA_DIR, { recursive: true })

const characterPath = join(DATA_DIR, 'characters.json')
const questionPath = join(DATA_DIR, 'questions.json')

writeFileSync(characterPath, JSON.stringify(characters, null, 2))
writeFileSync(questionPath, JSON.stringify(questions, null, 2))

console.log(`\nWrote ${characters.length} characters → ${characterPath}`)
console.log(`Wrote ${questions.length} questions   → ${questionPath}`)
console.log('\nDone. Run `pnpm simulate` to start a simulation.')
