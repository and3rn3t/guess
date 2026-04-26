#!/usr/bin/env npx tsx
/**
 * Use GPT-4o to audit and improve question text for each active attribute.
 * Evaluates each question for: neutrality, clarity, single-attribute focus,
 * and guessing-game phrasing style.
 *
 * Dry run (default): writes suggestions to data/question-improvements.jsonl
 * Apply (--apply):   writes improvements to staging.db + calls admin API
 *
 * Usage:
 *   npx tsx scripts/improve-questions.ts [--apply] [--limit N]
 *
 * Env vars:
 *   OPENAI_API_KEY   required
 *   BASE_URL         worker URL for --apply (default: https://guess.andernet.dev)
 *   ADMIN_SECRET     required for --apply
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

const STAGING_DB = 'data/staging.db'
const OUTPUT_JSONL = 'data/question-improvements.jsonl'
const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? parseInt(process.argv[i + 1] ?? '100', 10) : undefined
})()

const BASE_URL = process.env.BASE_URL || 'https://guess.andernet.dev'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = 'gpt-4o'
const BATCH_SIZE = 20
const CONCURRENCY = 3

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY env var is required')
  process.exit(1)
}

if (APPLY && !ADMIN_SECRET) {
  console.error('Error: ADMIN_SECRET env var is required for --apply')
  process.exit(1)
}

interface QuestionInput {
  attribute_key: string
  display_text: string
  current_question: string
}

interface Improvement {
  attribute_key: string
  original: string
  suggested: string
  changed: boolean
  reason: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
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

const SYSTEM_PROMPT = `You are an expert game designer auditing yes/no questions for an AI guessing game.
For each question, determine if it clearly and neutrally tests exactly one attribute.

Good questions:
- Are phrased as yes/no questions
- Focus on a single concrete trait
- Are clear and unambiguous
- Use present tense and simple language
- Are neutral (not leading or biased)
- Example: "Is this character from a video game?"

Bad patterns to fix:
- Compound traits ("Is this character tall and muscular?") → split or pick one
- Vague phrasing ("Is this character from the past?") → clarify ("Is this character from a historical era?")
- Leading questions ("Surely this character is evil, right?") → neutralize
- Double negatives ("Is this character not from the future?") → rewrite positively

For EACH question, return a JSON object with these fields:
- attribute_key: the key provided
- original: the original question text
- suggested: your improved question (or same as original if no change needed)
- changed: boolean (true if you changed it)
- reason: one concise sentence explaining what you changed and why (or "No change needed" if unchanged)

Return a JSON array of these objects. Output ONLY valid JSON, no markdown or explanation.`

async function improveBatch(batch: QuestionInput[]): Promise<Improvement[]> {
  const userContent = batch.map((q, i) =>
    `${i + 1}. attribute_key: "${q.attribute_key}" | display: "${q.display_text}" | question: "${q.current_question}"`
  ).join('\n')

  const response = await openaiRequest({
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  }) as { choices: Array<{ message: { content: string } }> }

  const text = response.choices[0]?.message?.content ?? '[]'
  try {
    return JSON.parse(text) as Improvement[]
  } catch {
    // Try stripping markdown code fences
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(cleaned) as Improvement[]
  }
}

async function applyImprovement(imp: Improvement): Promise<void> {
  // Update staging.db
  const db = new Database(STAGING_DB)
  db.prepare(
    'UPDATE questions SET text = ? WHERE attribute_key = ?'
  ).run(imp.suggested, imp.attribute_key)
  db.close()

  // Call admin API
  const resp = await fetch(`${BASE_URL}/api/admin/questions/${imp.attribute_key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText: imp.suggested, secret: ADMIN_SECRET }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Admin API ${resp.status}: ${text.slice(0, 200)}`)
  }
}

async function main() {
  const db = new Database(STAGING_DB, { readonly: true })

  const rows = db.prepare(`
    SELECT ad.key AS attribute_key,
           ad.display_text,
           COALESCE(q.text, ad.question_text) AS current_question
    FROM attribute_definitions ad
    LEFT JOIN questions q ON q.attribute_key = ad.key
    WHERE ad.is_active = 1
      AND COALESCE(q.text, ad.question_text) IS NOT NULL
    ORDER BY ad.key
  `).all() as QuestionInput[]

  db.close()

  const items = LIMIT ? rows.slice(0, LIMIT) : rows
  console.log(`Auditing ${items.length} questions (batch=${BATCH_SIZE}, concurrency=${CONCURRENCY})...`)
  if (APPLY) console.log(`Mode: APPLY (will write to staging.db + ${BASE_URL})`)
  else console.log(`Mode: DRY RUN (writing suggestions to ${OUTPUT_JSONL})`)

  const allImprovements: Improvement[] = []
  let changed = 0

  // Process in CONCURRENCY-limited parallel batches
  const batches: QuestionInput[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE))
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map(improveBatch))

    for (const batch of results) {
      for (const imp of batch) {
        allImprovements.push(imp)
        if (imp.changed) {
          changed++
          console.log(`  CHANGED: ${imp.attribute_key}`)
          console.log(`    Before: ${imp.original}`)
          console.log(`    After:  ${imp.suggested}`)
          console.log(`    Reason: ${imp.reason}`)
          if (APPLY) {
            await applyImprovement(imp)
            console.log(`    Applied.`)
          }
        }
      }
    }

    process.stderr.write(`Progress: ${Math.min((i + CONCURRENCY) * BATCH_SIZE, items.length)}/${items.length}\n`)
  }

  // Write JSONL output
  const outPath = path.resolve(OUTPUT_JSONL)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const lines = allImprovements.map((r) => JSON.stringify(r)).join('\n')
  fs.writeFileSync(outPath, lines + '\n')

  console.log(`\nDone. Changed: ${changed}/${items.length}`)
  console.log(`Wrote ${allImprovements.length} rows → ${outPath}`)
  if (!APPLY && changed > 0) {
    console.log(`\nRun with --apply to write changes to staging.db and the admin API.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
