/**
 * AI Attribute Enrichment — Phase 4
 *
 * Uses GPT-4o-mini to fill boolean attributes for characters in the staging DB.
 * Reads characters + attribute definitions, batches through LLM, stores results locally,
 * then generates SQL to upload to D1.
 *
 * Usage (via run.ts):
 *   npx tsx scripts/ingest/run.ts enrich [batchSize] [--limit N] [--category cat] [--min-pop 0.1]
 *   npx tsx scripts/ingest/run.ts enrich [batchSize] [--new-attrs-only]
 *   npx tsx scripts/ingest/run.ts enrich-upload [--remote]
 *   npx tsx scripts/ingest/run.ts enrich-stats
 */
import { existsSync, mkdirSync } from 'node:fs';
import { getDb, closeDb } from './db.js';
import { getConfig } from './config.js';
import { withRetry } from './rate-limiter.js';
import { formatElapsed } from './utils.js';
import type { Category } from './types.js';

// Prompt builders extracted to ./enrich/prompts.ts (RF.1).
// Re-exported for back-compat with discover-attributes.ts and run.ts consumers.
import { buildSystemPrompt, buildUserPrompt } from './enrich/prompts.js';
export { buildSystemPrompt, buildUserPrompt };

// LLM client extracted to ./enrich/llm-client.ts (RF.1).
import {
  MODEL,
  callLLM,
  callOpenRouter,
  mergeConsensusResults,
  type ChatMessage,
} from './enrich/llm-client.js';

// Storage + parsing extracted to ./enrich/storage.ts (RF.1).
import {
  initEnrichSchema,
  loadAttributeDefinitions,
  cacheAttributeDefinitions,
  getAttributesForCategory,
  getPendingCharacters,
  storeEnrichmentResults,
  markFailed,
  parseResponse,
  CACHE_DIR,
  type EnrichResult,
  type EnrichOptions,
} from './enrich/storage.js';
export { loadAttributeDefinitions, initEnrichSchema } from './enrich/storage.js';
export type { AttributeDef } from './enrich/storage.js';

// Adversarial validation + dispute upload extracted to ./enrich/adversarial.ts (RF.1).
import { runAdversarialValidation } from './enrich/adversarial.js';
export { generateDisputeUploadSQL } from './enrich/adversarial.js';

// Changelog + character_attributes upload SQL extracted to ./enrich/upload-sql.ts (RF.1).
import {
  appendEnrichChangelog,
  generateEnrichUploadSQL,
} from './enrich/upload-sql.js';
export { generateEnrichUploadSQL };

// ---------------------------------------------------------------------------
// Local-only Types
// ---------------------------------------------------------------------------

interface EnrichStats {
  totalCharacters: number;
  enriched: number;
  pending: number;
  failed: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCost: number;
}

// Schema, attribute-defs, storeEnrichmentResults, markFailed, parseResponse,
// getPendingCharacters, getAttributesForCategory all extracted to
// ./enrich/storage.ts (RF.1) and imported above.



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
  const pending = getPendingCharacters(db, opts, allAttrs);
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

  if (opts.model2) {
    if (!config.openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY not set — required for --model2');
    }
    console.log(`EN.2 consensus mode: primary=${MODEL}, secondary=${opts.model2}`);
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

      // EN.2: optional second-model consensus pass
      let parsed2: Record<string, Record<string, boolean | null>> | null = null;
      if (opts.model2 && config.openrouterApiKey) {
        try {
          const response2 = await withRetry(
            () => callOpenRouter(messages, opts.model2!, config.openrouterApiKey),
            2,
            3000
          );
          const content2 = response2.choices[0]?.message?.content;
          if (content2) {
            parsed2 = parseResponse(content2, batch.map(c => c.id), validKeySet);
            totalPromptTokens += response2.usage.prompt_tokens;
            totalCompletionTokens += response2.usage.completion_tokens;
          }
        } catch (err) {
          console.warn(`  [model2 warn] ${(err as Error).message} — using primary only`);
        }
      }

      const results: EnrichResult[] = [];

      for (const char of batch) {
        const attrs = parsed[char.id];
        if (!attrs) {
          markFailed(db, [char.id], 'No data in LLM response');
          failedCount++;
          continue;
        }

        let finalAttrs = attrs;
        let perAttrConfidence: Record<string, number> | undefined;
        let perAttrContested: Record<string, boolean> | undefined;

        if (parsed2) {
          const attrs2 = parsed2[char.id] ?? {};
          const consensus = mergeConsensusResults(attrs, attrs2);
          finalAttrs = consensus.merged;
          perAttrConfidence = consensus.confidence;
          perAttrContested = consensus.contested;
        }

        results.push({
          characterId: char.id,
          attributes: finalAttrs,
          confidence: perAttrConfidence,
          contested: perAttrContested,
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
  const elapsed = Date.now() - startTime;
  const totalCost = ((totalPromptTokens / 1_000_000) * 0.15) + ((totalCompletionTokens / 1_000_000) * 0.60);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Enrichment complete in ${formatElapsed(elapsed)}`);
  console.log(`  Enriched: ${enrichedCount} | Failed: ${failedCount}`);
  console.log(`  Tokens: ${totalPromptTokens.toLocaleString()} prompt + ${totalCompletionTokens.toLocaleString()} completion`);
  console.log(`  Cost: $${totalCost.toFixed(4)}`);
  console.log('='.repeat(60));

  // EN.6: append a row to the enrichment changelog
  appendEnrichChangelog({
    enriched: enrichedCount,
    failed: failedCount,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    cost: totalCost,
    elapsedMs: elapsed,
    mode: opts.model2
      ? `consensus:${opts.model2}`
      : opts.newAttrsOnly
        ? 'new-attrs-only'
        : opts.category
          ? `category:${opts.category}`
          : 'full',
  });

  // EP: adversarial validation pass
  if (opts.validate) {
    console.log('\nRunning adversarial attribute validation...');
    const validateLimit = Math.min(50, enrichedCount > 0 ? enrichedCount : 20);
    await runAdversarialValidation(db, allAttrs, config, validateLimit, false);
  }

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
