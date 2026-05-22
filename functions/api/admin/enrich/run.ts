/**
 * Server-side attribute enrichment batch runner.
 *
 * Exported for use from enrich/start.ts via context.waitUntil().
 * No local filesystem or staging DB required — all reads/writes go directly to D1.
 *
 * Steps for each batch:
 *  1. Load active attribute_definitions from D1
 *  2. Find characters with no character_attributes rows
 *  3. Call OpenAI (direct — bypasses AI Gateway to ensure AbortController works)
 *  4. Parse response and write to character_attributes
 *  5. Log to pipeline_runs; clear enrich_job row when done
 */
import { type Env } from '../../_helpers'
import { d1CachePut } from '../../_d1_cache'

const MODEL = 'gpt-4o-mini'
// Use direct OpenAI endpoint — the AI Gateway acts as a buffering proxy and
// does not honour AbortController abort signals from the Worker, causing the
// fetch to hang indefinitely even after the abort fires.
const OPENAI_DIRECT = 'https://api.openai.com/v1/chat/completions'

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
 * The enrich_job D1 row is created before calling this and
 * cleared here when the batch completes (success or error) so the SSE
 * stream reflects the job state correctly.
 */
export async function runServerEnrichBatch(env: Env, batchId: string, origin?: string): Promise<void> {
  const db = env.GUESS_DB
  if (!db || !env.OPENAI_API_KEY) {
    if (db) {
      await db.prepare('DELETE FROM enrich_job WHERE batch_id = ?').bind(batchId).run().catch(() => {})
    }
    return
  }

  const runIso = new Date().toISOString()
  const evidence = `enrichment:openai:${MODEL}:run=${runIso}`

  // Track whether this invocation found and started a pending character.
  // Used in the finally block to decide whether to chain the next invocation.
  let foundPending = false
  let promptTokens = 0
  let completionTokens = 0
  let processedStatus: 'success' | 'error' = 'error'

  try {
    // 0. Clean up stale 'running' rows from any previous Worker crash / wall-clock kill.
    // 90 s is safely past the 25 s AbortController + chain overhead, but short enough
    // that a stuck row is recovered on the next run attempt.
    await db
      .prepare(
        `UPDATE pipeline_runs SET status='error', error='Stale — previous Worker run did not complete'
         WHERE step='enrich' AND status='running' AND created_at < unixepoch() - 90`
      )
      .run()

    // 1. Load active attribute definitions from D1
    const attrRows = await db
      .prepare(`SELECT key, question_text, categories FROM attribute_definitions WHERE is_active = 1 ORDER BY key`)
      .all<AttributeDef>()
    const allAttrs = attrRows.results ?? []
    if (allAttrs.length === 0) return

    // 2. Find ONE character with no character_attributes rows.
    // Each Worker invocation processes exactly one character; subsequent characters
    // are handled by chained invocations (see finally block) to stay within the
    // ~30 s waitUntil() wall-clock budget per Pages Function invocation.
    const charRows = await db
      .prepare(
        `SELECT id, name, category, description FROM characters c
         WHERE NOT EXISTS (
           SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1
         )
         AND (
           SELECT COUNT(*) FROM pipeline_runs pr
           WHERE pr.character_id = c.id AND pr.step = 'enrich' AND pr.status = 'error'
           AND pr.created_at > unixepoch() - 3600
         ) < 3
         ORDER BY popularity DESC
         LIMIT 1`
      )
      .all<PendingChar>()
    const char = (charRows.results ?? [])[0]
    if (!char) return

    foundPending = true

    // 3. Mark character as running
    await db
      .prepare(`INSERT INTO pipeline_runs (run_batch, character_id, step, status) VALUES (?, ?, 'enrich', 'running')`)
      .bind(batchId, char.id)
      .run()

    const t0 = Date.now()

    // 4. Call OpenAI in parallel chunks to stay well under the ~30 s wall-clock limit.
    // ~234 attrs × ~6 completion tokens each ≈ 1,400 tokens in a single call — at
    // gpt-4o-mini's throughput (~50 tok/s) that takes 28-30 s, right at the limit.
    // Splitting into 4 parallel calls (~58 attrs each, ~350 tokens each) cuts
    // wall-clock response time to ~7 s, leaving ~23 s of headroom for chainOrClear.
    const chunkSize = Math.ceil(allAttrs.length / 4)
    const attrChunks = Array.from({ length: 4 }, (_, i) => allAttrs.slice(i * chunkSize, (i + 1) * chunkSize)).filter((c) => c.length > 0)
    const chunkResults = await Promise.all(attrChunks.map((chunk) => callOpenAIChunk(env, char, chunk)))

    let charError: string | null = null
    const attrResult: Record<string, boolean | null> = {}

    for (const r of chunkResults) {
      if (r.error) { charError = r.error; break }
      Object.assign(attrResult, r.attrResult)
      promptTokens += r.promptTokens
      completionTokens += r.completionTokens
    }

    const durationMs = Date.now() - t0

    if (charError || Object.keys(attrResult).length === 0) {
      await db
        .prepare(
          `UPDATE pipeline_runs SET status='error', error=?, duration_ms=?
           WHERE run_batch=? AND character_id=? AND step='enrich' AND status='running'`
        )
        .bind(charError ?? 'No result in LLM response', durationMs, batchId, char.id)
        .run()
      return
    }

    // 5. Write character_attributes (chunked to stay within D1 batch limit of 100)
    const attrStmts = Object.entries(attrResult).map(([key, val]) => {
      const intVal = val === true ? 1 : val === false ? 0 : null
      const confidence = val === null ? 0.65 : 0.85
      return db
        .prepare(
          `INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence, evidence)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(char.id, key, intVal, confidence, evidence)
    })
    for (let i = 0; i < attrStmts.length; i += 100) {
      await db.batch(attrStmts.slice(i, i + 100))
    }

    await db
      .prepare(
        `UPDATE pipeline_runs SET status='success', duration_ms=?
         WHERE run_batch=? AND character_id=? AND step='enrich' AND status='running'`
      )
      .bind(durationMs, batchId, char.id)
      .run()

    processedStatus = 'success'

    // Persist token stats for dashboard (7-day TTL)
    await d1CachePut(
      db,
      'enrich:last-batch-stats',
      {
        batchId,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        characters: 1,
        runAt: runIso,
        status: 'success',
      },
      604800,
    )
  } finally {
    await chainOrClear(env, batchId, origin, foundPending, processedStatus)
  }
}

/**
 * Call OpenAI for a single attribute chunk for one character.
 * Using a per-chunk AbortController (25 s) ensures the abort fires before the
 * ~30 s wall-clock limit kills the Worker, so the 'running' row gets cleaned up.
 *
 * Returns the parsed attribute map plus token counts. Never throws — errors are
 * returned as { error: string } so callers can handle partial results.
 */
async function callOpenAIChunk(
  env: Env,
  char: PendingChar,
  attrChunk: AttributeDef[],
): Promise<{ attrResult: Record<string, boolean | null>; promptTokens: number; completionTokens: number; error: string | null }> {
  // Only include keys from this chunk so the LLM response is scoped correctly.
  const chunkKeySet = new Set(attrChunk.map((a) => a.key))
  const systemPrompt = buildSystemPrompt(attrChunk.map((a) => ({ key: a.key, questionText: null })))
  const llmAbort = new AbortController()
  // 20 s — fires ~10 s before the 30 s wall-clock limit so the finally block
  // can write the error row and fire the chain before the Worker is killed.
  // Each chunk is ~58 attrs / ~350 tokens and should complete in ~7 s, so 20 s
  // gives ~13 s of slack even for the slowest OpenAI responses.
  const llmTimeout = setTimeout(() => llmAbort.abort(), 20_000)
  try {
    const res = await fetch(OPENAI_DIRECT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY!}`,
      },
      signal: llmAbort.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserPrompt([char]) },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        // ~117 attrs × ~6 tokens per key:value ≈ 700 completion tokens per chunk.
        max_tokens: 1024,
      }),
    })
    if (res.ok) {
      const body = await res.json() as OpenAIResponse
      const content = body.choices[0]?.message?.content ?? '{}'
      const promptTokens = body.usage?.prompt_tokens ?? 0
      const completionTokens = body.usage?.completion_tokens ?? 0
      const parsed = parseOpenAIContent(content, [char.id], chunkKeySet)
      return { attrResult: parsed[char.id] ?? {}, promptTokens, completionTokens, error: null }
    } else {
      const errText = await res.text()
      return { attrResult: {}, promptTokens: 0, completionTokens: 0, error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` }
    }
  } catch (fetchErr) {
    const error = (fetchErr instanceof Error && fetchErr.name === 'AbortError')
      ? 'LLM request timed out after 20 s'
      : String(fetchErr).slice(0, 300)
    return { attrResult: {}, promptTokens: 0, completionTokens: 0, error }
  } finally {
    clearTimeout(llmTimeout)
  }
}

/**
 * After processing one character, either:
 *  - chain: decrement `remaining` in D1 and fire a new Worker invocation
 *    (each gets a fresh ~30 s waitUntil() window), OR
 *  - clear: delete the enrich_job row so the SSE stream shows the job as done.
 */
async function chainOrClear(
  env: Env,
  batchId: string,
  origin: string | undefined,
  foundPending: boolean,
  _status: 'success' | 'error',
): Promise<void> {
  const db = env.GUESS_DB
  if (!db) return

  // No origin means test/local mode — just clear the job.
  if (!origin) {
    await db.prepare('DELETE FROM enrich_job WHERE batch_id = ?').bind(batchId).run().catch(() => {})
    return
  }

  // Look up the current job state
  const row = await db
    .prepare(
      'SELECT id, remaining, chain_token FROM enrich_job WHERE batch_id = ? AND expires_at > unixepoch() LIMIT 1',
    )
    .bind(batchId)
    .first<{ id: number; remaining: number; chain_token: string | null }>()
    .catch(() => null)

  if (!row) return // Already cleared by a stop signal.

  const remaining = row.remaining - 1

  // Stop chaining if: no more requested, or this run found nothing to process
  // (all characters already enriched — no point firing empty invocations).
  if (remaining <= 0 || !foundPending) {
    await db.prepare('DELETE FROM enrich_job WHERE id = ?').bind(row.id).run().catch(() => {})
    return
  }

  // Generate a fresh chain token for the next invocation (single-use)
  const newChainToken = crypto.randomUUID()

  // Persist decremented count and new token before firing the chain so the
  // next invocation reads the correct remaining value even if it starts before we return.
  try {
    await db
      .prepare(
        'UPDATE enrich_job SET remaining = ?, chain_token = ?, chain_token_consumed = 0 WHERE id = ?',
      )
      .bind(remaining, newChainToken, row.id)
      .run()
  } catch {
    // If we can't update, don't chain — clear the job so it isn't stuck.
    await db.prepare('DELETE FROM enrich_job WHERE id = ?').bind(row.id).run().catch(() => {})
    return
  }

  // Fire a new Pages Function invocation. The new Worker gets its own fresh
  // ~30 s waitUntil() wall-clock budget to process the next character.
  await fetch(`${origin}/api/admin/enrich/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Chain-Token': newChainToken,
    },
    body: JSON.stringify({ action: 'chain', batchId }),
  }).catch(async () => {
    // Chain fetch failed — clear job so it doesn't appear permanently stuck.
    await db.prepare('DELETE FROM enrich_job WHERE id = ?').bind(row.id).run().catch(() => {})
  })
}
