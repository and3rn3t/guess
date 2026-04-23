/**
 * AI Attribute Enrichment — Phase 4
 *
 * Uses GPT-4o-mini to fill boolean attributes for characters in the staging DB.
 * Reads characters + attribute definitions, batches through LLM, stores results locally,
 * then generates SQL to upload to D1.
 *
 * Usage (via run.ts):
 *   npx tsx scripts/ingest/run.ts enrich [batchSize] [--limit N] [--category cat] [--min-pop 0.1]
 *   npx tsx scripts/ingest/run.ts enrich-upload [--remote]
 *   npx tsx scripts/ingest/run.ts enrich-stats
 */
import Database from 'better-sqlite3';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db.js';
import { getConfig } from './config.js';
import { RateLimiter, withRetry } from './rate-limiter.js';
import { formatElapsed } from './utils.js';
import type { Category } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'enrich-cache');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttributeDef {
  key: string;
  displayText: string;
  categories: string | null; // JSON array or null (= all)
}

interface EnrichResult {
  characterId: string;
  attributes: Record<string, boolean | null>;
  tokensUsed: { prompt: number; completion: number };
}

interface EnrichStats {
  totalCharacters: number;
  enriched: number;
  pending: number;
  failed: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCost: number;
}

// ---------------------------------------------------------------------------
// Schema: Add enrichment tables to staging DB
// ---------------------------------------------------------------------------

export function initEnrichSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrichment_attributes (
      character_id  TEXT NOT NULL,
      attribute_key TEXT NOT NULL,
      value         INTEGER,  -- 1=true, 0=false, NULL=unknown
      confidence    REAL DEFAULT 1.0,
      PRIMARY KEY (character_id, attribute_key)
    );

    CREATE TABLE IF NOT EXISTS enrichment_status (
      character_id   TEXT PRIMARY KEY,
      status         TEXT NOT NULL DEFAULT 'pending',  -- pending, done, failed
      prompt_tokens  INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      error          TEXT,
      updated_at     INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_enrich_status ON enrichment_status(status);
  `);
}

// ---------------------------------------------------------------------------
// Attribute definitions (cached locally from D1)
// ---------------------------------------------------------------------------

const ATTR_CACHE_FILE = path.join(CACHE_DIR, 'attribute_definitions.json');

export function loadAttributeDefinitions(): AttributeDef[] {
  if (existsSync(ATTR_CACHE_FILE)) {
    return JSON.parse(readFileSync(ATTR_CACHE_FILE, 'utf-8'));
  }
  throw new Error(
    `Attribute definitions not cached. Run:\n` +
    `  npx wrangler d1 execute GUESS_DB --env production --remote ` +
    `--command "SELECT key, display_text, categories FROM attribute_definitions ORDER BY key" ` +
    `--json > data/enrich-cache/attribute_definitions_raw.json\n` +
    `Then run: npx tsx scripts/ingest/enrich.ts cache-attrs`
  );
}

/** Cache attribute definitions from a wrangler JSON export. */
export function cacheAttributeDefinitions(): void {
  const rawPath = path.join(CACHE_DIR, 'attribute_definitions_raw.json');
  if (!existsSync(rawPath)) {
    throw new Error(`Missing ${rawPath}. Run the wrangler command first.`);
  }
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  const attrs: AttributeDef[] = raw[0].results.map((r: Record<string, string>) => ({
    key: r.key,
    displayText: r.display_text,
    categories: r.categories ?? null,
  }));
  writeFileSync(ATTR_CACHE_FILE, JSON.stringify(attrs, null, 2));
  console.log(`Cached ${attrs.length} attribute definitions to ${ATTR_CACHE_FILE}`);
}

/** Get attributes relevant to a category. */
function getAttributesForCategory(allAttrs: AttributeDef[], category: Category): AttributeDef[] {
  return allAttrs.filter(a => {
    if (!a.categories) return true; // null = applies to all
    try {
      const cats: string[] = JSON.parse(a.categories);
      return cats.includes(category);
    } catch {
      return true;
    }
  });
}

// ---------------------------------------------------------------------------
// LLM Client
// ---------------------------------------------------------------------------

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// Rate limit: gpt-4o-mini tier 1 ~500 RPM, use 400 RPM to be safe
const rateLimiter = new RateLimiter(100, 400, 60_000);

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: { message: { content: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callLLM(messages: ChatMessage[], apiKey: string): Promise<OpenAIResponse> {
  await rateLimiter.wait();

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1, // Low temp for factual classification
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<OpenAIResponse>;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(attrKeys: string[]): string {
  // Group by prefix for compact display
  return `You are a fictional character classifier. For each character, determine boolean attributes.

RULES:
- Return a JSON object where keys are character IDs and values are objects mapping attribute keys to true, false, or null.
- true = the attribute clearly applies to this character
- false = the attribute clearly does NOT apply
- null = genuinely ambiguous, unknown, or insufficient information
- Be decisive: prefer true/false over null when you have reasonable knowledge
- Use your broad knowledge of fiction, games, anime, comics, movies, TV shows, and books
- You MUST include ALL ${attrKeys.length} attribute keys for each character

ATTRIBUTE KEYS (${attrKeys.length} total — respond with these exact keys):
${attrKeys.join(', ')}

RESPONSE FORMAT (strict JSON, one entry per character):
{
  "char_id_1": { "attr1": true, "attr2": false, ... all ${attrKeys.length} attrs },
  "char_id_2": { ... }
}`;
}

function buildUserPrompt(
  characters: { id: string; name: string; category: string; description: string | null }[]
): string {
  const charDescriptions = characters.map(c => {
    const desc = c.description ? ` — ${c.description.slice(0, 200)}` : '';
    return `- ${c.id}: "${c.name}" (${c.category})${desc}`;
  }).join('\n');

  return `Classify these characters:\n\n${charDescriptions}`;
}

// ---------------------------------------------------------------------------
// Batch Enrichment
// ---------------------------------------------------------------------------

interface EnrichOptions {
  batchSize?: number;
  concurrency?: number;
  limit?: number;
  category?: Category;
  minPopularity?: number;
  dryRun?: boolean;
}

function getPendingCharacters(
  db: Database.Database,
  opts: EnrichOptions
): { id: string; name: string; category: string; description: string | null; popularity: number }[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Only canonical characters (from dedup_map)
  conditions.push(`rc.id IN (SELECT canonical_id FROM dedup_map)`);

  // Not already enriched
  conditions.push(`rc.id NOT IN (SELECT character_id FROM enrichment_status WHERE status = 'done')`);

  if (opts.category) {
    conditions.push(`rc.category = ?`);
    params.push(opts.category);
  }

  if (opts.minPopularity !== undefined) {
    conditions.push(`rc.popularity >= ?`);
    params.push(opts.minPopularity);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts.limit ? `LIMIT ?` : '';
  if (opts.limit) params.push(opts.limit);

  const sql = `
    SELECT rc.id, rc.name, rc.category, rc.description, rc.popularity
    FROM raw_characters rc
    ${where}
    ORDER BY rc.popularity DESC
    ${limitClause}
  `;

  return db.prepare(sql).all(...params) as {
    id: string; name: string; category: string; description: string | null; popularity: number;
  }[];
}

function storeEnrichmentResults(db: Database.Database, results: EnrichResult[]): void {
  const insertAttr = db.prepare(`
    INSERT OR REPLACE INTO enrichment_attributes (character_id, attribute_key, value)
    VALUES (?, ?, ?)
  `);

  const upsertStatus = db.prepare(`
    INSERT INTO enrichment_status (character_id, status, prompt_tokens, completion_tokens, updated_at)
    VALUES (?, 'done', ?, ?, unixepoch())
    ON CONFLICT(character_id) DO UPDATE SET
      status = 'done',
      prompt_tokens = excluded.prompt_tokens,
      completion_tokens = excluded.completion_tokens,
      error = NULL,
      updated_at = unixepoch()
  `);

  const storeBatch = db.transaction((batch: EnrichResult[]) => {
    for (const result of batch) {
      for (const [key, value] of Object.entries(result.attributes)) {
        const intVal = value === true ? 1 : value === false ? 0 : null;
        insertAttr.run(result.characterId, key, intVal);
      }
      upsertStatus.run(
        result.characterId,
        result.tokensUsed.prompt,
        result.tokensUsed.completion
      );
    }
  });

  storeBatch(results);
}

function markFailed(db: Database.Database, characterIds: string[], error: string): void {
  const stmt = db.prepare(`
    INSERT INTO enrichment_status (character_id, status, error, updated_at)
    VALUES (?, 'failed', ?, unixepoch())
    ON CONFLICT(character_id) DO UPDATE SET
      status = 'failed',
      error = excluded.error,
      updated_at = unixepoch()
  `);

  const markBatch = db.transaction((ids: string[]) => {
    for (const id of ids) {
      stmt.run(id, error);
    }
  });

  markBatch(characterIds);
}

function parseResponse(
  raw: string,
  characterIds: string[],
  validKeys: Set<string>
): Record<string, Record<string, boolean | null>> {
  const parsed = JSON.parse(raw);
  const result: Record<string, Record<string, boolean | null>> = {};

  for (const charId of characterIds) {
    const charData = parsed[charId];
    if (!charData || typeof charData !== 'object') continue;

    result[charId] = {};
    for (const [key, val] of Object.entries(charData)) {
      if (!validKeys.has(key)) continue;
      if (val === true) result[charId][key] = true;
      else if (val === false) result[charId][key] = false;
      else result[charId][key] = null;
    }
  }

  return result;
}

export async function runEnrichment(opts: EnrichOptions = {}): Promise<EnrichStats> {
  const startTime = Date.now();
  const batchSize = opts.batchSize ?? 5;
  const concurrency = opts.concurrency ?? 10;
  const config = getConfig();

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY not set in .dev.vars or .env.local');
  }

  // Initialize
  initEnrichSchema();
  const allAttrs = loadAttributeDefinitions();
  const db = getDb();

  console.log(`Loaded ${allAttrs.length} attribute definitions`);

  // Get pending characters
  const pending = getPendingCharacters(db, opts);
  console.log(`Found ${pending.length} characters to enrich (batch=${batchSize}, concurrency=${concurrency})`);

  if (pending.length === 0) {
    console.log('Nothing to do!');
    return getEnrichStats();
  }

  if (opts.dryRun) {
    console.log('Dry run — not calling LLM.');
    const totalBatches = Math.ceil(pending.length / batchSize);
    console.log(`Would process ${pending.length} characters in ${totalBatches} batches`);
    const sampleBatch = pending.slice(0, batchSize);
    const sampleAttrs = getAttributesForCategory(allAttrs, sampleBatch[0].category as Category);
    console.log(`Sample batch (${sampleBatch.length} chars, ${sampleAttrs.length} attrs):`);
    for (const c of sampleBatch) {
      console.log(`  ${c.id}: ${c.name} (${c.category}, pop=${c.popularity.toFixed(3)})`);
    }
    return getEnrichStats();
  }

  // Split into batches
  const batches: typeof pending[] = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize));
  }

  // Shared counters
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let enrichedCount = 0;
  let failedCount = 0;
  let completedBatches = 0;

  // Process a single batch
  const processBatch = async (batch: typeof pending, batchIdx: number): Promise<void> => {
    const categories = new Set(batch.map(c => c.category));
    const relevantAttrs = categories.size === 1
      ? getAttributesForCategory(allAttrs, batch[0].category as Category)
      : allAttrs;
    const attrKeys = relevantAttrs.map(a => a.key);
    const validKeySet = new Set(attrKeys);

    const charNames = batch.map(c => c.name).join(', ');

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(attrKeys) },
        { role: 'user', content: buildUserPrompt(batch) },
      ];

      const response = await withRetry(
        () => callLLM(messages, config.openaiApiKey),
        3,
        2000
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const finishReason = response.choices[0]?.finish_reason;
      if (finishReason === 'length') {
        throw new Error(`Response truncated (hit max_tokens). Reduce batch size.`);
      }

      const parsed = parseResponse(content, batch.map(c => c.id), validKeySet);
      const results: EnrichResult[] = [];

      for (const char of batch) {
        const attrs = parsed[char.id];
        if (!attrs) {
          markFailed(db, [char.id], 'No data in LLM response');
          failedCount++;
          continue;
        }

        results.push({
          characterId: char.id,
          attributes: attrs,
          tokensUsed: {
            prompt: Math.round(response.usage.prompt_tokens / batch.length),
            completion: Math.round(response.usage.completion_tokens / batch.length),
          },
        });
      }

      if (results.length > 0) {
        storeEnrichmentResults(db, results);
        enrichedCount += results.length;
      }

      totalPromptTokens += response.usage.prompt_tokens;
      totalCompletionTokens += response.usage.completion_tokens;
      completedBatches++;

      const elapsed = formatElapsed(Date.now() - startTime);
      const rate = (enrichedCount / ((Date.now() - startTime) / 1000)).toFixed(1);
      const totalCost = ((totalPromptTokens / 1_000_000) * 0.15) + ((totalCompletionTokens / 1_000_000) * 0.60);
      const batchCost = ((response.usage.prompt_tokens / 1_000_000) * 0.15) +
        ((response.usage.completion_tokens / 1_000_000) * 0.60);

      console.log(
        `[${completedBatches}/${batches.length}] ${charNames.slice(0, 60)} | ` +
        `✓${results.length} | ${response.usage.prompt_tokens}+${response.usage.completion_tokens}tok | ` +
        `$${batchCost.toFixed(4)} | total: $${totalCost.toFixed(2)} | ${rate}/s | ${elapsed}`
      );
    } catch (err) {
      const error = err as Error;
      console.error(`[${batchIdx + 1}] ✗ ${charNames.slice(0, 40)}: ${error.message}`);
      markFailed(db, batch.map(c => c.id), error.message);
      failedCount += batch.length;
      completedBatches++;
    }
  };

  // Concurrent execution with a pool
  console.log(`\nStarting enrichment: ${batches.length} batches, ${concurrency} concurrent...\n`);

  const pool: Promise<void>[] = [];
  let nextBatch = 0;

  const scheduleNext = (): Promise<void> | undefined => {
    if (nextBatch >= batches.length) return undefined;
    const idx = nextBatch++;
    const p = processBatch(batches[idx], idx).then(() => {
      pool.splice(pool.indexOf(p), 1);
      const next = scheduleNext();
      if (next) pool.push(next);
    });
    return p;
  };

  // Start initial pool
  for (let i = 0; i < Math.min(concurrency, batches.length); i++) {
    const p = scheduleNext();
    if (p) pool.push(p);
  }

  // Wait for all to complete
  while (pool.length > 0) {
    await Promise.race(pool);
  }

  // Final summary
  const totalCost = ((totalPromptTokens / 1_000_000) * 0.15) + ((totalCompletionTokens / 1_000_000) * 0.60);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Enrichment complete in ${formatElapsed(Date.now() - startTime)}`);
  console.log(`  Enriched: ${enrichedCount} | Failed: ${failedCount}`);
  console.log(`  Tokens: ${totalPromptTokens.toLocaleString()} prompt + ${totalCompletionTokens.toLocaleString()} completion`);
  console.log(`  Cost: $${totalCost.toFixed(4)}`);
  console.log('='.repeat(60));

  return getEnrichStats();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function getEnrichStats(): EnrichStats {
  initEnrichSchema();
  const db = getDb();

  const total = (db.prepare(
    `SELECT COUNT(DISTINCT canonical_id) as c FROM dedup_map`
  ).get() as { c: number }).c;

  const enriched = (db.prepare(
    `SELECT COUNT(*) as c FROM enrichment_status WHERE status = 'done'`
  ).get() as { c: number }).c;

  const failed = (db.prepare(
    `SELECT COUNT(*) as c FROM enrichment_status WHERE status = 'failed'`
  ).get() as { c: number }).c;

  const tokens = db.prepare(
    `SELECT COALESCE(SUM(prompt_tokens), 0) as p, COALESCE(SUM(completion_tokens), 0) as c
     FROM enrichment_status WHERE status = 'done'`
  ).get() as { p: number; c: number };

  const cost = ((tokens.p / 1_000_000) * 0.15) + ((tokens.c / 1_000_000) * 0.60);

  return {
    totalCharacters: total,
    enriched,
    pending: total - enriched - failed,
    failed,
    totalPromptTokens: tokens.p,
    totalCompletionTokens: tokens.c,
    estimatedCost: cost,
  };
}

export function showEnrichStats(): void {
  const stats = getEnrichStats();
  const pct = stats.totalCharacters > 0
    ? ((stats.enriched / stats.totalCharacters) * 100).toFixed(1)
    : '0';

  console.log('\n=== Enrichment Stats ===');
  console.log(`  Total characters:  ${stats.totalCharacters.toLocaleString()}`);
  console.log(`  Enriched:          ${stats.enriched.toLocaleString()} (${pct}%)`);
  console.log(`  Failed:            ${stats.failed.toLocaleString()}`);
  console.log(`  Pending:           ${stats.pending.toLocaleString()}`);
  console.log(`  Prompt tokens:     ${stats.totalPromptTokens.toLocaleString()}`);
  console.log(`  Completion tokens: ${stats.totalCompletionTokens.toLocaleString()}`);
  console.log(`  Estimated cost:    $${stats.estimatedCost.toFixed(4)}`);

  // Attribute fill stats
  const db = getDb();
  const attrStats = db.prepare(`
    SELECT
      COUNT(*) as total_rows,
      COUNT(CASE WHEN value = 1 THEN 1 END) as true_count,
      COUNT(CASE WHEN value = 0 THEN 1 END) as false_count,
      COUNT(CASE WHEN value IS NULL THEN 1 END) as null_count
    FROM enrichment_attributes
  `).get() as { total_rows: number; true_count: number; false_count: number; null_count: number };

  if (attrStats.total_rows > 0) {
    console.log(`\n  Attribute values:`);
    console.log(`    Total:  ${attrStats.total_rows.toLocaleString()}`);
    console.log(`    True:   ${attrStats.true_count.toLocaleString()} (${((attrStats.true_count / attrStats.total_rows) * 100).toFixed(1)}%)`);
    console.log(`    False:  ${attrStats.false_count.toLocaleString()} (${((attrStats.false_count / attrStats.total_rows) * 100).toFixed(1)}%)`);
    console.log(`    Null:   ${attrStats.null_count.toLocaleString()} (${((attrStats.null_count / attrStats.total_rows) * 100).toFixed(1)}%)`);
  }
}

// ---------------------------------------------------------------------------
// Generate Upload SQL for D1
// ---------------------------------------------------------------------------

interface UploadOptions {
  outputFile?: string;
  minConfidence?: number;
}

export function generateEnrichUploadSQL(opts: UploadOptions = {}): string {
  const outputFile = opts.outputFile ?? 'migrations/0006_character_attributes.sql';
  initEnrichSchema();
  const db = getDb();

  const rows = db.prepare(`
    SELECT ea.character_id, ea.attribute_key, ea.value, ea.confidence
    FROM enrichment_attributes ea
    INNER JOIN enrichment_status es ON ea.character_id = es.character_id AND es.status = 'done'
    WHERE ea.value IS NOT NULL
    ORDER BY ea.character_id, ea.attribute_key
  `).all() as { character_id: string; attribute_key: string; value: number; confidence: number }[];

  console.log(`Generating SQL for ${rows.length.toLocaleString()} attribute values...`);

  const lines: string[] = [];
  // Build INSERT statements in chunks of 500 values
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    lines.push('INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence) VALUES');
    const values = chunk.map(r => {
      const charId = r.character_id.replace(/'/g, "''");
      const attrKey = r.attribute_key.replace(/'/g, "''");
      return `  ('${charId}', '${attrKey}', ${r.value}, ${r.confidence})`;
    });
    lines.push(values.join(',\n') + ';\n');
  }

  const sql = lines.join('\n');

  // Ensure output directory exists
  const dir = path.dirname(path.resolve(outputFile));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(outputFile, sql);
  console.log(`Written to ${outputFile} (${(sql.length / 1024 / 1024).toFixed(1)} MB, ${rows.length.toLocaleString()} rows)`);

  return outputFile;
}

// ---------------------------------------------------------------------------
// Retry failed characters
// ---------------------------------------------------------------------------

export async function retryFailed(opts: EnrichOptions = {}): Promise<void> {
  initEnrichSchema();
  const db = getDb();

  // Reset failed status to pending
  const resetCount = db.prepare(
    `UPDATE enrichment_status SET status = 'pending', error = NULL WHERE status = 'failed'`
  ).run().changes;

  console.log(`Reset ${resetCount} failed characters to pending`);

  if (resetCount > 0) {
    await runEnrichment(opts);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point (for direct execution)
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'stats';

  try {
    if (command === 'cache-attrs') {
      if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
      cacheAttributeDefinitions();
    } else if (command === 'stats') {
      showEnrichStats();
    } else if (command === 'run') {
      const batchSize = parseInt(args[1] ?? '5');
      const limit = args.includes('--limit')
        ? parseInt(args[args.indexOf('--limit') + 1])
        : undefined;
      const catIdx = args.indexOf('--category');
      const category = catIdx >= 0 ? args[catIdx + 1] as Category : undefined;
      const minPop = args.includes('--min-pop')
        ? parseFloat(args[args.indexOf('--min-pop') + 1])
        : undefined;
      const dryRun = args.includes('--dry-run');

      await runEnrichment({ batchSize, limit, category, minPopularity: minPop, dryRun });
    } else if (command === 'upload') {
      generateEnrichUploadSQL();
    } else if (command === 'retry') {
      await retryFailed();
    } else {
      console.log(`
Usage: npx tsx scripts/ingest/enrich.ts <command> [options]

Commands:
  cache-attrs              Cache attribute definitions from D1 export
  run [batchSize] [opts]   Run enrichment (default batch=5)
  stats                    Show enrichment statistics
  upload                   Generate D1 migration SQL for character_attributes
  retry                    Retry previously failed characters

Options for 'run':
  --limit N                Max characters to process
  --category <cat>         Only enrich characters in this category
  --min-pop <float>        Minimum popularity threshold (0-1)
  --dry-run                Preview what would be processed
      `);
    }
  } finally {
    closeDb();
  }
}

// Only run if executed directly
if (process.argv[1]?.endsWith('enrich.ts')) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
