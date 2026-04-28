#!/usr/bin/env npx tsx
/**
 * Classify question difficulty (easy/medium/hard) using GPT-4o.
 *
 * Difficulty rubric:
 *   easy   — observable at a glance; most people would know immediately
 *            (e.g. "Is this character human?", "Is this a female character?")
 *   medium — requires some familiarity with the character
 *            (e.g. "Is this character a villain?", "Does this character have a sidekick?")
 *   hard   — requires deep knowledge or is a niche distinguishing trait
 *            (e.g. "Does this character wear glasses?", "Is this character left-handed?")
 *
 * Dry run (default): writes classifications to data/question-difficulty.jsonl
 * Apply (--apply):   updates staging.db questions.difficulty + calls admin API
 *
 * Usage:
 *   npx tsx scripts/classify-difficulty.ts [--apply] [--limit N]
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
import { z } from 'zod'

const STAGING_DB = 'data/staging.db'
const OUTPUT_JSONL = 'data/question-difficulty.jsonl'
const APPLY = process.argv.includes('--apply')
const IS_REMOTE = process.argv.includes('--remote')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? parseInt(process.argv[i + 1] ?? '200', 10) : undefined
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
const BATCH_SIZE = 30
const CONCURRENCY = 3

function d1Query(sql: string): unknown[] {
  const escaped = sql.replace(/"/g, '\\"')
  const out = execSync(
    `npx wrangler d1 execute ${DB_NAME} --env ${ENV_FLAG} --remote --json --command "${escaped}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: unknown[]; success: boolean }>
  return parsed[0]?.results ?? []
}

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
  question: string
  current_difficulty: string | null
}

const ClassificationSchema = z.object({
  attribute_key: z.string(),
  question: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  reason: z.string(),
})

type Classification = z.infer<typeof ClassificationSchema>

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

const SYSTEM_PROMPT = `You are classifying yes/no questions for an AI guessing game by difficulty level.

Difficulty rubric:
  easy   — Observable at a glance. Most players would know the answer immediately without deep knowledge.
           Examples: "Is this character animated?", "Is this a female character?", "Is this character human?"

  medium — Requires some familiarity with the character or their story/franchise.
           Examples: "Is this character a villain?", "Is this character a leader or authority figure?",
                     "Does this character have a mentor?", "Is this character known for humor?"

  hard   — Requires deep or specific knowledge. Distinguishes between very similar characters.
           Examples: "Does this character wear glasses?", "Does this character have a catchphrase?",
                     "Is this character an only child?", "Does this character have a nemesis?"

For EACH question, return a JSON object with:
- attribute_key: the key provided
- question: the question text
- difficulty: one of "easy", "medium", "hard"
- reason: one concise sentence explaining the classification

Return a JSON array of these objects. Output ONLY valid JSON, no markdown or explanation.`

async function classifyBatch(batch: QuestionInput[]): Promise<Classification[]> {
  const userContent = batch.map((q, i) =>
    `${i + 1}. attribute_key: "${q.attribute_key}" | question: "${q.question}"`
  ).join('\n')

  const response = await openaiRequest({
    model: OPENAI_MODEL,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  }) as { choices: Array<{ message: { content: string } }> }

  const text = response.choices[0]?.message?.content ?? '[]'
  try {
    const raw = JSON.parse(text)
    return z.array(ClassificationSchema).parse(raw)
  } catch {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return z.array(ClassificationSchema).parse(JSON.parse(cleaned))
  }
}

async function applyClassification(cls: Classification): Promise<void> {
  // Update staging.db (skip when using --remote; staging.db lacks game tables)
  if (!IS_REMOTE) {
    const db = new Database(STAGING_DB)
    db.prepare(
      'UPDATE questions SET difficulty = ? WHERE attribute_key = ?'
    ).run(cls.difficulty, cls.attribute_key)
    db.close()
  }

  // Call admin API
  const resp = await fetch(`${BASE_URL}/api/admin/questions/${cls.attribute_key}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(ADMIN_SECRET).toString('base64')}`,
    },
    body: JSON.stringify({ difficulty: cls.difficulty }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    process.stderr.write(`  Admin API ${resp.status} for ${cls.attribute_key}: ${text.slice(0, 200)}\n`)
  }
}

async function main() {
  let rows: QuestionInput[]

  if (IS_REMOTE) {
    process.stderr.write(`Fetching questions from D1 (${ENV_FLAG})...\n`)
    rows = d1Query(
      `SELECT ad.key AS attribute_key,
              COALESCE(q.text, ad.question_text) AS question,
              q.difficulty AS current_difficulty
       FROM attribute_definitions ad
       LEFT JOIN questions q ON q.attribute_key = ad.key
       WHERE ad.is_active = 1
         AND COALESCE(q.text, ad.question_text) IS NOT NULL
       ORDER BY ad.key`
    ) as QuestionInput[]
  } else {
    const db = new Database(STAGING_DB, { readonly: true })
    rows = db.prepare(`
      SELECT ad.key AS attribute_key,
             COALESCE(q.text, ad.question_text) AS question,
             q.difficulty AS current_difficulty
      FROM attribute_definitions ad
      LEFT JOIN questions q ON q.attribute_key = ad.key
      WHERE ad.is_active = 1
        AND COALESCE(q.text, ad.question_text) IS NOT NULL
      ORDER BY ad.key
    `).all() as QuestionInput[]
    db.close()
  }

  const items = LIMIT ? rows.slice(0, LIMIT) : rows
  const alreadyClassified = items.filter((r) => r.current_difficulty).length
  const needsClassification = items.filter((r) => !r.current_difficulty)

  console.log(`Total active questions: ${items.length}`)
  console.log(`Already classified: ${alreadyClassified}`)
  console.log(`Needs classification: ${needsClassification.length}`)
  if (APPLY) console.log(`Mode: APPLY (will write to staging.db + ${BASE_URL})`)
  else console.log(`Mode: DRY RUN (writing to ${OUTPUT_JSONL})`)

  if (needsClassification.length === 0) {
    console.log('All questions already classified!')
    return
  }

  const allClassifications: Classification[] = []
  const dist = { easy: 0, medium: 0, hard: 0 }

  const batches: QuestionInput[][] = []
  for (let i = 0; i < needsClassification.length; i += BATCH_SIZE) {
    batches.push(needsClassification.slice(i, i + BATCH_SIZE))
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map(classifyBatch))

    for (const batch of results) {
      for (const cls of batch) {
        allClassifications.push(cls)
        dist[cls.difficulty] = (dist[cls.difficulty] ?? 0) + 1
        if (APPLY) {
          await applyClassification(cls)
        }
      }
    }

    const done = Math.min((i + CONCURRENCY) * BATCH_SIZE, needsClassification.length)
    process.stderr.write(`Progress: ${done}/${needsClassification.length}\n`)
  }

  // Write JSONL output
  const outPath = path.resolve(OUTPUT_JSONL)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const lines = allClassifications.map((r) => JSON.stringify(r)).join('\n')
  fs.writeFileSync(outPath, lines + '\n')

  console.log(`\nDone. easy=${dist.easy}  medium=${dist.medium}  hard=${dist.hard}`)
  console.log(`Wrote ${allClassifications.length} rows → ${outPath}`)
  if (!APPLY) {
    console.log(`\nRun with --apply to write difficulty values to staging.db and the admin API.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
