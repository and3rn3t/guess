/**
 * Server-side attribute enrichment batch runner.
 *
 * Exported for use from enrich/start.ts via context.waitUntil().
 * No local filesystem or staging DB required — all reads/writes go directly to D1.
 *
 * Steps for each batch:
 *  1. Load active attribute_definitions from D1
 *  2. Find characters with no character_attributes rows
 *  3. Call OpenAI (via AI Gateway) with all characters in one batch
 *  4. Parse response and write to character_attributes
 *  5. Log to pipeline_runs; clear KV job flag when done
 */
import { type Env, getCompletionsEndpoint, getLlmHeaders } from '../../_helpers'

const MODEL = 'gpt-4o-mini'

interface AttributeDef {
  key: string
  question_text: string | null
  categories: string | null
}

interface PendingChar {
  id: string
  name: string
  category: string
  description: string | null
}

interface OpenAIResponse {
  choices: { message: { content: string } }[]
  usage: { prompt_tokens: number; completion_tokens: number }
}

export function buildSystemPrompt(attrs: Array<{ key: string; questionText: string | null }>): string {
  const keys = attrs.map((a) => a.key)
  const attrsWithQuestion = attrs.filter((a) => a.questionText)
  const keyMeansSection = attrsWithQuestion.length > 0
    ? `\nWHAT EACH KEY MEANS (use these to understand each attribute):\n${attrsWithQuestion.map((a) => `- ${a.key}: ${a.questionText}`).join('\n')}\n`
    : ''

  return `You are a fictional character classifier. For each character, determine boolean attributes.

RULES:
- Return a JSON object where keys are character IDs and values are objects mapping attribute keys to true, false, or null.
- true = the attribute clearly applies to this character
- false = the attribute clearly does NOT apply
- null = genuinely ambiguous, unknown, or insufficient information
- Be decisive: prefer true/false over null when you have reasonable knowledge
- Use your broad knowledge of fiction, games, anime, comics, movies, TV shows, and books
- You MUST include ALL ${keys.length} attribute keys for each character

ATTRIBUTE KEYS (${keys.length} total — respond with these exact keys):
${keys.join(', ')}${keyMeansSection}
RESPONSE FORMAT (strict JSON, one entry per character):
{
  "char_id_1": { "attr1": true, "attr2": false, ... all ${keys.length} attrs }
}`
}

export function buildUserPrompt(chars: PendingChar[]): string {
  const lines = chars.map((c) => {
    const desc = c.description ? ` — ${c.description.slice(0, 200)}` : ''
    return `- ${c.id}: "${c.name}" (${c.category})${desc}`
  })
  return `Classify these characters:\n\n${lines.join('\n')}`
}

export function parseOpenAIContent(
  raw: string,
  charIds: string[],
  validKeys: Set<string>
): Record<string, Record<string, boolean | null>> {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
  const result: Record<string, Record<string, boolean | null>> = {}
  for (const charId of charIds) {
    const charData = parsed[charId]
    if (!charData || typeof charData !== 'object') continue
    result[charId] = {}
    for (const [key, val] of Object.entries(charData as Record<string, unknown>)) {
      if (!validKeys.has(key)) continue
      result[charId][key] = val === true ? true : val === false ? false : null
    }
  }
  return result
}

/**
 * Run one enrichment batch server-side.
 *
 * Intended to be called via `context.waitUntil()` so the HTTP response
 * returns immediately while the LLM call and D1 writes happen in the
 * background (up to the Worker's extended duration limit).
 *
 * The KV flag `admin:enrich-start` is set before calling this and
 * cleared here when the batch completes (success or error) so the SSE
 * stream reflects the job state correctly.
 */
export async function runServerEnrichBatch(env: Env, batchId: string, limit: number): Promise<void> {
  const db = env.GUESS_DB
  if (!db || !env.OPENAI_API_KEY) {
    await env.GUESS_KV?.delete('admin:enrich-start')
    return
  }

  const runIso = new Date().toISOString()
  const evidence = `enrichment:openai:${MODEL}:run=${runIso}`

  try {
    // 0. Clean up stale 'running' rows from any previous Worker crash / CPU timeout (> 5 min old)
    await db
      .prepare(
        `UPDATE pipeline_runs SET status='error', error='Stale — previous Worker run did not complete'
         WHERE step='enrich' AND status='running' AND created_at < unixepoch() - 300`
      )
      .run()

    // 1. Load active attribute definitions from D1
    const attrRows = await db
      .prepare(`SELECT key, question_text, categories FROM attribute_definitions WHERE is_active = 1 ORDER BY key`)
      .all<AttributeDef>()
    const allAttrs = attrRows.results ?? []
    if (allAttrs.length === 0) return

    const allKeys = allAttrs.map((a) => a.key)
    const validKeySet = new Set(allKeys)

    // 2. Find characters with no character_attributes rows
    const charRows = await db
      .prepare(
        `SELECT id, name, category, description FROM characters c
         WHERE NOT EXISTS (
           SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1
         )
         ORDER BY popularity DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<PendingChar>()
    const pending = charRows.results ?? []
    if (pending.length === 0) return

    // 3. Insert pipeline_run rows as 'running'
    const insertRunStmts = pending.map((c) =>
      db.prepare(
        `INSERT INTO pipeline_runs (run_batch, character_id, step, status) VALUES (?, ?, 'enrich', 'running')`
      ).bind(batchId, c.id)
    )
    await db.batch(insertRunStmts)

    const t0 = Date.now()

    // 4. Single OpenAI call for the whole batch
    let content = '{}'
    let llmError: string | null = null
    let promptTokens = 0
    let completionTokens = 0

    // 25 s hard timeout — gives the finally block time to run before the
    // Worker CPU budget expires (~30 s default). Without this, a hung
    // OpenAI connection causes the Worker to be killed mid-flight, leaving
    // pipeline_runs rows stuck as 'running' and the KV flag never cleared.
    const llmAbort = new AbortController()
    const llmTimeout = setTimeout(() => llmAbort.abort(), 25_000)

    try {
      const res = await fetch(getCompletionsEndpoint(env), {
        method: 'POST',
        headers: getLlmHeaders(env),
        signal: llmAbort.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(allAttrs.map((a) => ({ key: a.key, questionText: a.question_text }))) },
            { role: 'user', content: buildUserPrompt(pending) },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
          max_tokens: 16384,
        }),
      })
      if (res.ok) {
        const body = await res.json() as OpenAIResponse
        content = body.choices[0]?.message?.content ?? '{}'
        promptTokens = body.usage?.prompt_tokens ?? 0
        completionTokens = body.usage?.completion_tokens ?? 0
      } else {
        const errText = await res.text()
        llmError = `OpenAI ${res.status}: ${errText.slice(0, 300)}`
      }
    } catch (fetchErr) {
      llmError = (fetchErr instanceof Error && fetchErr.name === 'AbortError')
        ? 'LLM request timed out after 25 s'
        : String(fetchErr).slice(0, 300)
    } finally {
      clearTimeout(llmTimeout)
    }

    const durationMs = Date.now() - t0

    // Persist token stats for dashboard display regardless of success/error (7-day TTL)
    await env.GUESS_KV?.put(
      'enrich:last-batch-stats',
      JSON.stringify({
        batchId,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        characters: pending.length,
        runAt: runIso,
        status: llmError ? 'error' : 'success',
      }),
      { expirationTtl: 604800 },
    )

    if (llmError) {
      // Mark all pipeline_runs as error
      const errorStmts = pending.map((c) =>
        db.prepare(
          `UPDATE pipeline_runs SET status='error', error=?, duration_ms=?
           WHERE run_batch=? AND character_id=? AND step='enrich' AND status='running'`
        ).bind(llmError, durationMs, batchId, c.id)
      )
      await db.batch(errorStmts)
      return
    }

    // 5. Parse response and build D1 write statements
    const parsed = parseOpenAIContent(content, pending.map((c) => c.id), validKeySet)
    const attrStmts: ReturnType<D1Database['prepare']>[] = []
    const runUpdateStmts: ReturnType<D1Database['prepare']>[] = []

    for (const char of pending) {
      const charResult = parsed[char.id]
      if (!charResult || Object.keys(charResult).length === 0) {
        runUpdateStmts.push(
          db.prepare(
            `UPDATE pipeline_runs SET status='error', error='No result in LLM response', duration_ms=?
             WHERE run_batch=? AND character_id=? AND step='enrich' AND status='running'`
          ).bind(durationMs, batchId, char.id)
        )
        continue
      }

      for (const [key, val] of Object.entries(charResult)) {
        const intVal = val === true ? 1 : val === false ? 0 : null
        const confidence = val === null ? 0.65 : 0.85
        attrStmts.push(
          db.prepare(
            `INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence, evidence)
             VALUES (?, ?, ?, ?, ?)`
          ).bind(char.id, key, intVal, confidence, evidence)
        )
      }
      runUpdateStmts.push(
        db.prepare(
          `UPDATE pipeline_runs SET status='success', duration_ms=?
           WHERE run_batch=? AND character_id=? AND step='enrich' AND status='running'`
        ).bind(durationMs, batchId, char.id)
      )
    }

    // D1 batch limit is 100 — chunk if needed
    const allStmts = [...attrStmts, ...runUpdateStmts]
    for (let i = 0; i < allStmts.length; i += 100) {
      await db.batch(allStmts.slice(i, i + 100))
    }
  } finally {
    await env.GUESS_KV?.delete('admin:enrich-start')
  }
}
