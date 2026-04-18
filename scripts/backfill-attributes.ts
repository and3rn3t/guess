/**
 * Phase 2: Backfill existing characters with new attributes via LLM.
 *
 * Reads character names/categories from D1 (via wrangler), sends batches to
 * GPT-4o-mini to classify each character against the new attributes, then
 * outputs a SQL migration for inserting the results.
 *
 * Usage:
 *   export $(grep OPENAI_API_KEY .dev.vars | xargs)
 *   npx tsx scripts/backfill-attributes.ts > migrations/0004_backfill_new_attrs.sql
 */

import * as fs from 'fs'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('Set OPENAI_API_KEY env var')
  process.exit(1)
}

interface Attribute {
  key: string
  displayText: string
  questionText: string
}

interface CharacterInfo {
  id: string
  name: string
  category: string
}

// Load new attributes
const newAttributes: Attribute[] = JSON.parse(
  fs.readFileSync('scripts/expanded-attributes.json', 'utf-8')
)
const attrKeys = newAttributes.map((a) => a.key)

// Load characters from the existing database.ts (faster than querying D1)
// We parse the DEFAULT_CHARACTERS array
function loadCharacters(): CharacterInfo[] {
  const dbSrc = fs.readFileSync('src/lib/database.ts', 'utf-8')
  const chars: CharacterInfo[] = []

  // Match each character block: { id: "...", name: "...", category: "...", ... }
  const charRegex = /\{\s*id:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["'],\s*category:\s*["']([^"']+)["']/g
  let match
  while ((match = charRegex.exec(dbSrc)) !== null) {
    chars.push({ id: match[1], name: match[2], category: match[3] })
  }

  return chars
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  retries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.1,  // Low temp for factual classification
          max_tokens: 16000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!resp.ok) {
        const text = await resp.text()
        if (resp.status === 429 && attempt < retries) {
          const wait = attempt * 5000
          console.error(`  Rate limited, waiting ${wait}ms...`)
          await new Promise((r) => setTimeout(r, wait))
          continue
        }
        throw new Error(`OpenAI API error ${resp.status}: ${text}`)
      }

      const data = (await resp.json()) as { choices: { message: { content: string } }[] }
      return data.choices[0].message.content
    } catch (err) {
      if (attempt === retries) throw err
      console.error(`  Attempt ${attempt} failed, retrying...`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Unreachable')
}

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

async function classifyBatch(
  characters: CharacterInfo[],
  attrBatch: string[]
): Promise<Record<string, Record<string, boolean | null>>> {
  const systemPrompt = `You are an expert on fictional characters from all media (anime, movies, TV, comics, video games, books, cartoons).
You must classify each character against the given boolean attributes.
Output valid JSON only. No markdown.
For each character, return an object mapping attribute keys to true, false, or null (if genuinely unknown/ambiguous).
Be accurate — use your knowledge of each character. If unsure, use null.`

  const charList = characters
    .map((c) => `- ${c.name} (${c.category}) [id: ${c.id}]`)
    .join('\n')

  const attrList = attrBatch.join(', ')

  const userPrompt = `Classify these characters for the following boolean attributes:
Attributes: ${attrList}

Characters:
${charList}

Output JSON format:
{
  "results": {
    "<character_id>": {
      "<attribute_key>": true/false/null,
      ...
    },
    ...
  }
}`

  const raw = await callOpenAI(systemPrompt, userPrompt)
  const parsed = JSON.parse(raw) as { results: Record<string, Record<string, boolean | null>> }
  return parsed.results
}

async function main() {
  const characters = loadCharacters()
  console.error(`Loaded ${characters.length} characters`)
  console.error(`New attributes to classify: ${attrKeys.length}`)
  console.error(`Total values to generate: ${characters.length * attrKeys.length}`)

  // Split attributes into batches of ~40 to fit in context
  const ATTR_BATCH_SIZE = 40
  // Split characters into batches of ~20
  const CHAR_BATCH_SIZE = 20

  const attrBatches: string[][] = []
  for (let i = 0; i < attrKeys.length; i += ATTR_BATCH_SIZE) {
    attrBatches.push(attrKeys.slice(i, i + ATTR_BATCH_SIZE))
  }

  const charBatches: CharacterInfo[][] = []
  for (let i = 0; i < characters.length; i += CHAR_BATCH_SIZE) {
    charBatches.push(characters.slice(i, i + CHAR_BATCH_SIZE))
  }

  console.error(
    `Batches: ${charBatches.length} char batches × ${attrBatches.length} attr batches = ${charBatches.length * attrBatches.length} API calls`
  )

  // Collect all results
  const allResults: Map<string, Map<string, boolean | null>> = new Map()
  for (const c of characters) {
    allResults.set(c.id, new Map())
  }

  // Build all tasks
  interface Task {
    charBatch: CharacterInfo[]
    attrBatch: string[]
    idx: number
  }
  const tasks: Task[] = []
  for (const charBatch of charBatches) {
    for (const attrBatch of attrBatches) {
      tasks.push({ charBatch, attrBatch, idx: tasks.length + 1 })
    }
  }

  const CONCURRENCY = 5
  let completed = 0

  async function runTask(task: Task): Promise<void> {
    const charNames = task.charBatch.map((c) => c.name).join(', ')
    console.error(
      `  [${task.idx}/${tasks.length}] ${charNames.substring(0, 60)}... × ${task.attrBatch.length} attrs`
    )

    const results = await classifyBatch(task.charBatch, task.attrBatch)

    for (const [charId, attrs] of Object.entries(results)) {
      const charMap = allResults.get(charId)
      if (!charMap) {
        console.error(`    Warning: unknown character ID '${charId}' in response`)
        continue
      }
      for (const [key, val] of Object.entries(attrs)) {
        if (task.attrBatch.includes(key)) {
          charMap.set(key, val)
        }
      }
    }

    completed++
    if (completed % 5 === 0) {
      console.error(`  Progress: ${completed}/${tasks.length} complete`)
    }
  }

  // Run with concurrency limit
  async function runWithConcurrency(tasks: Task[], limit: number): Promise<void> {
    const executing: Set<Promise<void>> = new Set()
    for (const task of tasks) {
      const p = runTask(task).then(() => { executing.delete(p) })
      executing.add(p)
      if (executing.size >= limit) {
        await Promise.race(executing)
      }
    }
    await Promise.all(executing)
  }

  await runWithConcurrency(tasks, CONCURRENCY)

  // Generate SQL
  const lines: string[] = []
  lines.push('-- ============================================================')
  lines.push('-- Phase 2: Backfill new attributes for existing characters')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push(`-- Characters: ${characters.length}, New attributes: ${attrKeys.length}`)
  lines.push('-- ============================================================')
  lines.push('')

  let insertCount = 0
  let nullCount = 0

  for (const [charId, attrs] of allResults.entries()) {
    lines.push(`-- ${charId}`)
    for (const [key, val] of attrs.entries()) {
      if (val === null) {
        nullCount++
        continue // Don't insert nulls — absence means unknown
      }
      const sqlVal = val ? 1 : 0
      lines.push(
        `INSERT OR IGNORE INTO character_attributes (character_id, attribute_key, value) VALUES ('${esc(charId)}', '${esc(key)}', ${sqlVal});`
      )
      insertCount++
    }
    lines.push('')
  }

  console.error(`\nGenerated ${insertCount} INSERT statements (${nullCount} null values skipped)`)

  // Output SQL to stdout
  console.log(lines.join('\n'))

  console.error('Done! Pipe stdout to migrations/0004_backfill_new_attrs.sql')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
