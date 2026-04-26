#!/usr/bin/env npx tsx
/**
 * Propose new attributes using GPT-4o by analyzing confusion clusters and coverage gaps.
 *
 * Strategy:
 *   1. Load characters + attribute coverage from staging.db
 *   2. Optionally load simulation confusion data from D1 (--remote)
 *   3. Find attribute "coverage gaps": categories with < 60% character coverage
 *   4. Find frequently confused character pairs (from sim data or heuristic)
 *   5. Batch-prompt GPT-4o for discriminating attribute ideas
 *   6. POST proposals to /api/admin/proposed-attributes (--apply)
 *
 * Usage:
 *   npx tsx scripts/propose-attributes.ts [--apply] [--remote] [--env production|preview] [--limit N]
 *
 * Env vars:
 *   OPENAI_API_KEY   required
 *   BASE_URL         worker URL for --apply (default: https://guess.andernet.dev)
 *   ADMIN_SECRET     required for --apply
 */

import { execSync } from 'child_process'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

const STAGING_DB = 'data/staging.db'
const OUTPUT_JSONL = 'data/proposed-attributes.jsonl'
const APPLY = process.argv.includes('--apply')
const IS_REMOTE = process.argv.includes('--remote')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? parseInt(process.argv[i + 1] ?? '50', 10) : 50
})()
const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

const BASE_URL = process.env.BASE_URL || 'https://guess.andernet.dev'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = 'gpt-4o'

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY env var is required')
  process.exit(1)
}
if (APPLY && !ADMIN_SECRET) {
  console.error('Error: ADMIN_SECRET env var is required for --apply')
  process.exit(1)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function d1Query(sql: string): unknown[] {
  const escaped = sql.replace(/"/g, '\\"')
  const out = execSync(
    `wrangler d1 execute ${DB_NAME} --env ${ENV_FLAG} --remote --json --command "${escaped}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: unknown[]; success: boolean }>
  return parsed[0]?.results ?? []
}

async function openaiRequest(payload: unknown, retries = 4): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    if (resp.status === 429) {
      const wait = attempt * 3
      process.stderr.write(`  429, retrying in ${wait}s...\n`)
      await sleep(wait * 1000)
      continue
    }
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`OpenAI ${resp.status}: ${text.slice(0, 300)}`)
    }
    return resp.json()
  }
  throw new Error('OpenAI: too many retries')
}

interface Proposal {
  key: string
  display_text: string
  question_text: string
  rationale: string
  example_chars?: string // JSON array
  proposed_by: string
}

interface ConfusionRow {
  char_a: string
  char_b: string
  confusion_count: number
}

// Heuristic: find character pairs that share many attributes (likely confused)
function findHeuristicConfusions(
  db: InstanceType<typeof Database>,
  limit: number
): Array<{ aName: string; bName: string }> {
  const rows = db.prepare(`
    SELECT a.character_id AS a_id, b.character_id AS b_id,
           a_name.name AS a_name, b_name.name AS b_name,
           SUM(CASE WHEN a.value = b.value AND a.value IS NOT NULL THEN 1 ELSE 0 END) AS shared
    FROM character_attributes a
    JOIN character_attributes b
      ON a.attribute_key = b.attribute_key
      AND a.character_id < b.character_id
      AND a.value = b.value
    JOIN characters a_name ON a_name.id = a.character_id AND a_name.is_active = 1
    JOIN characters b_name ON b_name.id = b.character_id AND b_name.is_active = 1
    GROUP BY a.character_id, b.character_id
    ORDER BY shared DESC
    LIMIT ?
  `).all(limit) as Array<{ a_name: string; b_name: string; shared: number }>

  return rows.map((r) => ({ aName: r.a_name, bName: r.b_name }))
}

const SYSTEM_PROMPT = `You are an expert game designer proposing new yes/no attributes for an AI guessing game.

Given a list of character pairs that are frequently confused with each other, propose new discriminating attributes that would help tell them apart.
Also consider coverage gaps where existing attributes don't apply well.

For each proposal, output a JSON object with:
- key: camelCase attribute key (e.g. "hasRedHair", "isFromSpace", "speaksMultipleLanguages")
- display_text: human-readable attribute name (e.g. "Has red hair")
- question_text: yes/no question (e.g. "Does this character have red hair?")
- rationale: 1-2 sentences explaining why this attribute would be useful for distinguishing characters
- example_chars: JSON array of { name: string } for 2-4 characters this attribute applies to

Rules:
- The key must be camelCase, start with a verb/adjective ("is", "has", "from", "can", "wears", etc.)
- The attribute must be a concrete, verifiable trait — not subjective ("is cool") or compound ("is strong and fast")
- Prefer attributes that clearly divide the character pool ~50/50
- Do NOT propose: gender (already covered), species/human (already covered), fictional/real (already covered)
- Aim for variety across categories: appearance, personality, franchise/origin, occupation, relationships

Return ONLY a JSON array of proposal objects. No markdown, no explanation.`

async function proposeForConfusions(
  confusions: Array<{ aName: string; bName: string }>,
  existingKeys: Set<string>
): Promise<Proposal[]> {
  const pairs = confusions
    .slice(0, 20)
    .map((c) => `- ${c.aName} vs ${c.bName}`)
    .join('\n')

  const userContent = `Frequently confused character pairs:\n${pairs}\n\nExisting attribute keys to AVOID duplicating: ${[...existingKeys].slice(0, 50).join(', ')}\n\nPropose ${Math.min(LIMIT, 20)} new discriminating attributes.`

  const response = await openaiRequest({
    model: OPENAI_MODEL,
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  }) as { choices: Array<{ message: { content: string } }> }

  const text = response.choices[0]?.message?.content ?? '[]'
  try {
    const parsed = JSON.parse(text) as Proposal[]
    return parsed.map((p) => ({ ...p, proposed_by: 'llm' }))
  } catch {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned) as Proposal[]
    return parsed.map((p) => ({ ...p, proposed_by: 'llm' }))
  }
}

async function submitProposals(proposals: Proposal[]): Promise<void> {
  const resp = await fetch(`${BASE_URL}/api/admin/proposed-attributes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposals: proposals.map((p) => ({
        ...p,
        example_chars: p.example_chars ?? null,
      })),
      secret: ADMIN_SECRET,
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Admin API ${resp.status}: ${text.slice(0, 300)}`)
  }
  const result = await resp.json() as { inserted: number; submitted: number }
  console.log(`  Submitted ${result.submitted}, inserted ${result.inserted} new proposals`)
}

async function main() {
  const db = new Database(STAGING_DB, { readonly: true })

  // Existing attribute keys to avoid duplicates
  const existingKeys = new Set(
    (db.prepare('SELECT key FROM attribute_definitions').all() as Array<{ key: string }>).map((r) => r.key)
  )

  // Sim confusion data from D1 (if --remote), otherwise use heuristic
  let confusions: Array<{ aName: string; bName: string }> = []

  if (IS_REMOTE) {
    process.stderr.write('Fetching confusion data from D1...\n')
    const confRows = d1Query(
      `SELECT json_extract(c.value, '$.char_a') as char_a,
              json_extract(c.value, '$.char_b') as char_b,
              COUNT(*) as confusion_count
       FROM sim_game_stats sgs, json_each(sgs.confusion_pairs) c
       GROUP BY char_a, char_b
       ORDER BY confusion_count DESC
       LIMIT 30`
    ) as ConfusionRow[]

    if (confRows.length > 0) {
      confusions = confRows.map((r) => ({ aName: r.char_a, bName: r.char_b }))
    }
  }

  if (confusions.length === 0) {
    process.stderr.write('Using heuristic confusion detection from staging.db...\n')
    confusions = findHeuristicConfusions(db, 30)
  }

  db.close()

  if (confusions.length === 0) {
    console.error('No character data found. Is staging.db populated?')
    process.exit(1)
  }

  console.log(`Found ${confusions.length} confusion pairs. Top 5:`)
  for (const c of confusions.slice(0, 5)) {
    console.log(`  ${c.aName} vs ${c.bName}`)
  }

  console.log(`\nGenerating up to ${LIMIT} attribute proposals...`)
  if (APPLY) console.log(`Mode: APPLY (will POST to ${BASE_URL})`)
  else console.log(`Mode: DRY RUN (writing to ${OUTPUT_JSONL})`)

  const proposals = await proposeForConfusions(confusions, existingKeys)

  console.log(`\nGenerated ${proposals.length} proposals:`)
  for (const p of proposals) {
    console.log(`  [${p.key}] ${p.question_text}`)
    console.log(`    ${p.rationale}`)
  }

  // Write JSONL output
  const outPath = path.resolve(OUTPUT_JSONL)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const lines = proposals.map((r) => JSON.stringify(r)).join('\n')
  fs.writeFileSync(outPath, lines + '\n')
  console.log(`\nWrote ${proposals.length} proposals → ${outPath}`)

  if (APPLY && proposals.length > 0) {
    console.log('Submitting to admin API...')
    await submitProposals(proposals)
  } else if (!APPLY) {
    console.log(`\nRun with --apply to submit proposals to the admin API.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
