#!/usr/bin/env npx tsx
/**
 * Bulk character enrichment (overnight batch)
 *
 * Enriches characters that have no entries in `character_attributes`,
 * processing them in parallel batches directly via OpenAI + D1 — no
 * Cloudflare Worker wall-clock constraint.
 *
 * Optimizations vs the manual admin-dashboard pipeline:
 *  1. Category-scoped attr filtering — only sends attributes applicable to a
 *     character's category, reducing token usage by ~30-40% vs sending all attrs.
 *     Mirrors sparse-fill-attributes.ts. Chars are sorted by category so batches
 *     are homogeneous and get the smallest possible attr set.
 *  2. Exponential backoff retry — wraps every OpenAI call with withRetry (3
 *     attempts, 2 s base) so transient 429/503s don't kill an entire batch.
 *  3. Incremental flush — applies results to D1 every FLUSH_EVERY chars so a
 *     mid-run failure (network blip, GH Actions timeout) preserves partial progress.
 *
 * Throughput estimate (defaults: batch=5, chunks=4, concurrency=3):
 *  - 3 batches × 5 chars × 4 chunks = 60 OpenAI calls/round (~5-8s round-trip)
 *  - ≈ 90-150 chars/min → 1 000-char run completes in ~7-11 min
 *  - Token budget per run (1 000 chars): ~400-500K tokens (vs ~600K without
 *    category filtering) → ~$0.06-0.08 at gpt-4o-mini rates
 *
 * Usage:
 *   npx tsx scripts/bulk-enrich-characters.ts
 *     [--env preview|production]
 *     [--limit 1000]         # max chars to enrich per run (default: 1000)
 *     [--batch-size 5]       # chars per LLM call (default: 5)
 *     [--concurrency 3]      # parallel char batches (default: 3)
 *     [--attr-chunks 4]      # attr partitions per batch (default: 4, mirrors server-side)
 *     [--flush-every 50]     # apply to D1 every N chars (default: 50)
 *     [--dry-run]            # skip OpenAI + D1 write
 *
 * Designed for `.github/workflows/enrich-bulk-nightly.yml`. Lives in GH
 * Actions instead of the CF Worker because we need unlimited wall-clock time
 * and cannot increase the Workers waitUntil() budget past ~30 s.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Re-use the existing retry helper — handles 429/503/transient network errors.
import { withRetry } from "./ingest/rate-limiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "data", "bulk-enrich");
const WRANGLER_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "wrangler");
mkdirSync(OUT_DIR, { recursive: true });

// ── Env loading (mirrors sparse-fill-attributes.ts) ─────────────────────────
function loadEnvFiles(): void {
  for (const file of [".env.local", ".dev.vars"]) {
    const p = path.join(REPO_ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadEnvFiles();

// ── CLI args ─────────────────────────────────────────────────────────────────
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const ENV_FLAG = flag("--env", "production");
const LIMIT = Number.parseInt(flag("--limit", "1000"), 10);
const BATCH_SIZE = Number.parseInt(flag("--batch-size", "5"), 10);
const CONCURRENCY = Number.parseInt(flag("--concurrency", "3"), 10);
const ATTR_CHUNK_COUNT = Number.parseInt(flag("--attr-chunks", "4"), 10);
// Apply results to D1 every FLUSH_EVERY chars — preserves partial progress on failure.
const FLUSH_EVERY = Number.parseInt(flag("--flush-every", "50"), 10);
// Graceful runtime guard: stop claiming new batches after N minutes, flush progress, exit 0.
const MAX_MINUTES = Number.parseInt(flag("--max-minutes", "55"), 10);
const MIN_FLUSH_EVERY = 10;
const DRY_RUN = process.argv.includes("--dry-run");
const DB_NAME = ENV_FLAG === "production" ? "guess-db" : "guess-db-preview";
const MODEL = process.env.BULK_ENRICH_MODEL?.trim() || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const RUN_ISO = new Date().toISOString();

console.log(
  `[bulk-enrich] env=${ENV_FLAG} limit=${LIMIT} batch-size=${BATCH_SIZE} concurrency=${CONCURRENCY} attr-chunks=${ATTR_CHUNK_COUNT} flush-every=${FLUSH_EVERY} max-minutes=${MAX_MINUTES} dry-run=${DRY_RUN}`,
);
console.log(`[bulk-enrich] model=${MODEL}  run=${RUN_ISO}`);

// ── D1 helpers ───────────────────────────────────────────────────────────────
function d1<T>(sql: string): T[] {
  const out = execFileSync(
    WRANGLER_BIN,
    [
      "d1",
      "execute",
      DB_NAME,
      "--env",
      ENV_FLAG,
      "--remote",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", maxBuffer: 500 * 1024 * 1024 },
  );
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>;
  return parsed[0]?.results ?? [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableD1ApplyError(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    "internal error while starting up d1 db storage caused object to be reset",
    "etimedout",
    "econnreset",
    "fetch failed",
    "socket hang up",
    "service unavailable",
    "status code 503",
    "too many requests",
    "status code 429",
  ].some((marker) => normalized.includes(marker));
}

async function d1ApplyFile(filePath: string): Promise<void> {
  const maxAttempts = 4;
  const baseDelayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      execFileSync(
        WRANGLER_BIN,
        [
          "d1",
          "execute",
          DB_NAME,
          "--env",
          ENV_FLAG,
          "--remote",
          "--file",
          filePath,
        ],
        { stdio: "inherit" },
      );
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = isRetryableD1ApplyError(message);
      const canRetry = retryable && attempt < maxAttempts;
      if (!canRetry) {
        throw err;
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[bulk-enrich] D1 apply transient failure (attempt ${attempt}/${maxAttempts}) — retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface AttributeDef {
  key: string;
  question_text: string | null;
  categories: string | null;
}

interface CharRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface ChunkCallResult {
  attrsByChar: Record<string, Record<string, 0 | 1 | null>>;
  promptTokens: number;
  completionTokens: number;
}

interface FilledCell {
  characterId: string;
  attributeKey: string;
  value: 0 | 1 | null;
}

// ── Load attribute definitions from D1 ───────────────────────────────────────
console.log("[bulk-enrich] loading attribute definitions from D1 ...");
const allAttrs = d1<AttributeDef>(
  `SELECT key, question_text, categories FROM attribute_definitions WHERE is_active = 1 ORDER BY key`,
);
console.log(`[bulk-enrich]   ${allAttrs.length} active attributes`);

if (allAttrs.length === 0) {
  console.error("[bulk-enrich] no active attributes found — exiting.");
  process.exit(1);
}

// ── Category-scoped attr filtering (optimization 1) ───────────────────────────
// `attribute_definitions.categories` is a JSON array of applicable category
// slugs, or NULL meaning the attr applies to all categories. Building this map
// lets each batch only send attrs relevant to its character category, reducing
// prompt tokens by ~30-40% for category-specific attrs (e.g. hasWings, isShonen).
const universalAttrs = allAttrs.filter((a) => !a.categories);
const attrsByCategory = new Map<string, AttributeDef[]>();
for (const attr of allAttrs) {
  if (!attr.categories) continue; // universals handled separately
  let cats: string[] | null;
  try {
    cats = JSON.parse(attr.categories) as string[];
  } catch {
    cats = null;
  }
  if (!cats) continue;
  for (const cat of cats) {
    const list = attrsByCategory.get(cat) ?? [];
    list.push(attr);
    attrsByCategory.set(cat, list);
  }
}

/** Returns the attrs applicable to a set of categories (universal + category-specific union). */
function getAttrsForCategories(categories: Iterable<string>): AttributeDef[] {
  const keySet = new Set<string>();
  const result: AttributeDef[] = [];
  // Universal attrs first so chunk partitioning is deterministic
  for (const a of universalAttrs) {
    keySet.add(a.key);
    result.push(a);
  }
  for (const cat of categories) {
    for (const a of attrsByCategory.get(cat) ?? []) {
      if (!keySet.has(a.key)) {
        keySet.add(a.key);
        result.push(a);
      }
    }
  }
  return result;
}

console.log(
  `[bulk-enrich]   ${universalAttrs.length} universal + ${allAttrs.length - universalAttrs.length} category-specific attrs across ${attrsByCategory.size} categories`,
);

// ── Load unenriched characters from D1 ───────────────────────────────────────
console.log(
  `[bulk-enrich] loading up to ${LIMIT} unenriched characters (ordered by popularity) ...`,
);
const pendingChars = d1<CharRow>(
  `SELECT id, name, category, description FROM characters c
   WHERE description IS NOT NULL AND length(description) > 20
   AND NOT EXISTS (
     SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1
   )
   ORDER BY popularity DESC
   LIMIT ${LIMIT}`,
);
console.log(`[bulk-enrich]   ${pendingChars.length} characters to enrich`);

if (pendingChars.length === 0) {
  console.log("[bulk-enrich] all characters already enriched — exiting.");
  process.exit(0);
}

// Sort by category so batches are homogeneous — category-scoped attr filtering
// works best when all chars in a batch share the same category.
// The DB returns chars ordered by popularity DESC, and JS sort is stable, so
// popularity ranking is preserved within each category group.
pendingChars.sort((a, b) => a.category.localeCompare(b.category));

// ── LLM prompt builders (mirrors server-side run.ts) ─────────────────────────
function buildSystemPromptForChunk(attrChunk: AttributeDef[]): string {
  const keys = attrChunk.map((a) => a.key);
  const attrsWithQuestion = attrChunk.filter((a) => a.question_text);
  const keyMeansSection =
    attrsWithQuestion.length > 0
      ? `\nWHAT EACH KEY MEANS (use these to understand each attribute):\n${attrsWithQuestion
          .map((a) => `- ${a.key}: ${a.question_text}`)
          .join("\n")}\n`
      : "";

  return `You are a fictional character classifier. For each character, determine boolean attributes.

RULES:
- Return a JSON object where keys are character IDs and values are objects mapping attribute keys to true, false, or null.
- true = the attribute clearly applies to this character
- false = the attribute clearly does NOT apply
- null = genuinely ambiguous, unknown, or insufficient information
- Be decisive: prefer true/false over null when you have reasonable knowledge
- Use your broad knowledge of fiction, games, anime, comics, movies, TV shows, and books
- You MUST include ALL ${keys.length} attribute keys for EVERY character in the response

ATTRIBUTE KEYS (${keys.length} total — respond with these exact keys):
${keys.join(", ")}${keyMeansSection}
RESPONSE FORMAT (strict JSON, one entry per character):
{
  "char_id_1": { "attr1": true, "attr2": false, ... all ${keys.length} attrs },
  "char_id_2": { ... }
}`;
}

function buildUserPrompt(chars: CharRow[]): string {
  const lines = chars.map((c) => {
    const desc = c.description ? ` — ${c.description.slice(0, 200)}` : "";
    return `- ${c.id}: "${c.name}" (${c.category})${desc}`;
  });
  return `Classify these characters:\n\n${lines.join("\n")}`;
}

// ── OpenAI call for one attribute chunk × N characters ───────────────────────
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && !DRY_RUN) {
  console.error(
    "[bulk-enrich] OPENAI_API_KEY not set — pass --dry-run to skip the LLM call.",
  );
  process.exit(3);
}

async function callLLMChunk(
  chars: CharRow[],
  attrChunk: AttributeDef[],
): Promise<ChunkCallResult> {
  const chunkKeySet = new Set(attrChunk.map((a) => a.key));
  const systemPrompt = buildSystemPromptForChunk(attrChunk);
  const userPrompt = buildUserPrompt(chars);

  // Optimization 2: retry on 429 / 503 / transient errors with exponential backoff.
  // withRetry: 3 attempts, 2 s → 4 s → 8 s backoff (imported from ingest/rate-limiter.ts).
  const res = await withRetry(
    () =>
      fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey ?? ""}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
          // ~58 attrs × 5 chars × ~6 tokens per key:value ≈ 1 750 completion tokens.
          // 4 096 gives 2x headroom for longer attr keys / partial nulls / JSON overhead.
          max_tokens: 4096,
        }),
      }).then((r) => {
        // Throw on rate-limit / server errors so withRetry can back off and retry.
        if (r.status === 429 || r.status >= 500) {
          return r.text().then((body) => {
            throw new Error(`OpenAI ${r.status}: ${body.slice(0, 400)}`);
          });
        }
        return r;
      }),
    3, // max retries
    2000, // base delay ms
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as OpenAIResponse;
  const content = json.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  let parsed: Record<string, Record<string, unknown>>;
  try {
    parsed = JSON.parse(content) as Record<string, Record<string, unknown>>;
  } catch {
    throw new Error(
      `LLM response was not valid JSON: ${content.slice(0, 200)}`,
    );
  }

  const attrsByChar: Record<string, Record<string, 0 | 1 | null>> = {};
  for (const char of chars) {
    const charData = parsed[char.id];
    if (!charData || typeof charData !== "object") continue;
    attrsByChar[char.id] = {};
    for (const [key, val] of Object.entries(charData)) {
      if (!chunkKeySet.has(key)) continue;
      attrsByChar[char.id][key] = val === true ? 1 : val === false ? 0 : null;
    }
  }

  return {
    attrsByChar,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}

// ── Process one batch of chars: split attrs into chunks, call in parallel ────
async function processBatch(
  chars: CharRow[],
  batchLabel: string,
  /** Category-scoped attrs for this batch (optimization 1). */
  categoryAttrs: AttributeDef[],
): Promise<{
  filled: FilledCell[];
  promptTokens: number;
  completionTokens: number;
  enrichedCount: number;
}> {
  // Partition category-scoped attrs into ATTR_CHUNK_COUNT slices.
  // Fewer attrs per batch → smaller chunks → faster completion per chunk.
  const chunkSize = Math.ceil(categoryAttrs.length / ATTR_CHUNK_COUNT);
  const attrChunks = Array.from({ length: ATTR_CHUNK_COUNT }, (_, i) =>
    categoryAttrs.slice(i * chunkSize, (i + 1) * chunkSize),
  ).filter((c) => c.length > 0);

  // Merge per-char attr maps from each parallel chunk call
  const mergedByChar = new Map<string, Record<string, 0 | 1 | null>>(
    chars.map((c) => [c.id, {}]),
  );
  let promptTokens = 0;
  let completionTokens = 0;

  const chunkResults = await Promise.all(
    attrChunks.map((chunk) => callLLMChunk(chars, chunk)),
  );

  for (const result of chunkResults) {
    promptTokens += result.promptTokens;
    completionTokens += result.completionTokens;
    for (const [charId, attrs] of Object.entries(result.attrsByChar)) {
      const existing = mergedByChar.get(charId);
      if (existing) Object.assign(existing, attrs);
    }
  }

  // Flatten to FilledCell[], count chars that had any response
  const filled: FilledCell[] = [];
  let enrichedCount = 0;
  for (const char of chars) {
    const attrs = mergedByChar.get(char.id);
    if (!attrs || Object.keys(attrs).length === 0) {
      console.warn(
        `[bulk-enrich]   ${batchLabel} — ${char.id} (${char.name}): missing from LLM response`,
      );
      continue;
    }
    enrichedCount++;
    for (const [key, value] of Object.entries(attrs)) {
      filled.push({ characterId: char.id, attributeKey: key, value });
    }
  }

  return { filled, promptTokens, completionTokens, enrichedCount };
}

// ── Worker-pool concurrency ───────────────────────────────────────────────────
// Build batches with pre-computed category-scoped attr sets (optimization 1).
const batches: Array<{ chars: CharRow[]; categoryAttrs: AttributeDef[] }> = [];
for (let i = 0; i < pendingChars.length; i += BATCH_SIZE) {
  const chars = pendingChars.slice(i, i + BATCH_SIZE);
  // Union of applicable attrs for all categories present in this batch.
  // Since chars are sorted by category, most batches are single-category;
  // the union only widens at category-boundary batches.
  const categories = new Set(chars.map((c) => c.category));
  batches.push({ chars, categoryAttrs: getAttrsForCategories(categories) });
}

const totalBatches = batches.length;
const avgAttrs = Math.round(
  batches.reduce((s, b) => s + b.categoryAttrs.length, 0) / totalBatches,
);
console.log(
  `\n[bulk-enrich] ${totalBatches} batches (${BATCH_SIZE} chars/batch × ${ATTR_CHUNK_COUNT} attr-chunks, ${CONCURRENCY} parallel)` +
    `\n[bulk-enrich]   avg ${avgAttrs}/${allAttrs.length} attrs/batch after category-scoping` +
    ` (~${Math.round((1 - avgAttrs / allAttrs.length) * 100)}% token reduction)`,
);

const allFilled: FilledCell[] = [];
let totalPromptTokens = 0;
let totalCompletionTokens = 0;
let totalEnriched = 0;
let totalFailed = 0;
let flushCount = 0;
let isFlushing = false;
let lastFlushAt = 0;
let activeFlushEvery = FLUSH_EVERY;

// Defined here so flushAndApply() can use them (not at end-of-file)
const evidence = `enrichment:openai:${MODEL}:run=${RUN_ISO}`;
const sqlEscape = (s: string): string => s.replaceAll("'", "''");

// ── Incremental flush helper (optimization 3) ─────────────────────────────────
// Drains allFilled[], emits a SQL file, and applies it to D1 immediately.
// Called every FLUSH_EVERY chars so partial progress survives a mid-run failure.
async function flushAndApply(label: string): Promise<void> {
  if (allFilled.length === 0) return;
  // Drain the buffer atomically before the first await so concurrent workers
  // don't double-flush (JS is single-threaded; splice is synchronous).
  const cells = allFilled.splice(0, allFilled.length);
  const flushIdx = ++flushCount;
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\..*/, "");
  const outFile = path.join(
    OUT_DIR,
    `enrich-${ENV_FLAG}-${stamp}-flush${flushIdx}.sql`,
  );

  const sqlLines = [
    `-- Generated by scripts/bulk-enrich-characters.ts (flush ${flushIdx}) — ${label}`,
    `-- env=${ENV_FLAG} model=${MODEL} run=${RUN_ISO}`,
    "-- Note: no BEGIN TRANSACTION/COMMIT — D1 remote API rejects raw transaction control statements",
  ];
  const CHUNK = 200;
  for (let i = 0; i < cells.length; i += CHUNK) {
    const chunk = cells.slice(i, i + CHUNK);
    sqlLines.push(
      "INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence, evidence) VALUES",
    );
    sqlLines.push(
      chunk
        .map(
          (c) =>
            `  ('${sqlEscape(c.characterId)}', '${sqlEscape(c.attributeKey)}', ${
              c.value === null ? "NULL" : c.value
            }, ${c.value === null ? "0.65" : "0.85"}, '${sqlEscape(evidence)}')`,
        )
        .join(",\n") + ";",
    );
  }
  writeFileSync(outFile, sqlLines.join("\n"));
  console.log(
    `[bulk-enrich] flush #${flushIdx}: writing ${cells.length} cells → ${path.basename(outFile)}`,
  );
  try {
    await d1ApplyFile(outFile);
  } catch (err) {
    // Re-queue cells so a failed flush does not drop already-enriched results.
    allFilled.unshift(...cells);
    throw err;
  }
  console.log(`[bulk-enrich] flush #${flushIdx}: applied to D1`);
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function flushWithAdaptiveRecovery(
  label: string,
  maxAttempts: number,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await flushAndApply(label);
      if (attempt > 1) {
        console.log(
          `[bulk-enrich] flush recovered after ${attempt} attempt(s) with active flush-every=${activeFlushEvery}`,
        );
      }
      return true;
    } catch (err) {
      const message = getErrorMessage(err);
      if (!isRetryableD1ApplyError(message)) {
        throw err;
      }

      const previousFlushEvery = activeFlushEvery;
      activeFlushEvery = Math.max(MIN_FLUSH_EVERY, Math.floor(activeFlushEvery / 2));
      const backoffMs = 3000 * attempt;
      const canRetry = attempt < maxAttempts;

      console.warn(
        `[bulk-enrich] transient D1 flush failure (${attempt}/${maxAttempts}): ${message.slice(0, 220)}`,
      );
      if (activeFlushEvery !== previousFlushEvery) {
        console.warn(
          `[bulk-enrich] adaptive mode: reducing flush-every from ${previousFlushEvery} to ${activeFlushEvery}`,
        );
      }
      if (!canRetry) {
        console.error(
          `[bulk-enrich] flush attempts exhausted for ${label}; buffered cells retained in memory for next flush opportunity`,
        );
        return false;
      }
      await sleep(backoffMs);
    }
  }

  return false;
}

async function runWorkerPool(): Promise<void> {
  let batchIdx = 0;
  const deadlineMs = Date.now() + MAX_MINUTES * 60_000;
  let stopClaimingNewBatches = false;

  async function worker(): Promise<void> {
    while (true) {
      if (Date.now() >= deadlineMs) {
        stopClaimingNewBatches = true;
        break;
      }
      const idx = batchIdx++;
      if (idx >= totalBatches) break;
      const { chars, categoryAttrs } = batches[idx];
      const label = `batch ${idx + 1}/${totalBatches}`;

      if (DRY_RUN) {
        console.log(
          `[bulk-enrich] ${label} (dry-run): would process ${chars.length} chars with ${categoryAttrs.length} attrs`,
        );
        totalEnriched += chars.length;
        continue;
      }

      try {
        const result = await processBatch(chars, label, categoryAttrs);
        allFilled.push(...result.filled);
        totalPromptTokens += result.promptTokens;
        totalCompletionTokens += result.completionTokens;
        totalEnriched += result.enrichedCount;
        totalFailed += chars.length - result.enrichedCount;
        console.log(
          `[bulk-enrich] ${label} done — ${result.enrichedCount}/${chars.length} chars` +
            `  attrs=${categoryAttrs.length}  cells=${result.filled.length}` +
            `  tokens: +${result.promptTokens}p +${result.completionTokens}c`,
        );
      } catch (err) {
        console.error(
          `[bulk-enrich] ${label} FAILED: ${(err as Error).message}`,
        );
        totalFailed += chars.length;
      }

      // Flush every FLUSH_EVERY chars. Uses isFlushing guard to prevent concurrent
      // flushes — safe because JS await points are cooperative (not preemptive).
      if (
        !isFlushing &&
        totalEnriched - lastFlushAt >= activeFlushEvery &&
        allFilled.length > 0
      ) {
        isFlushing = true;
        try {
          const flushed = await flushWithAdaptiveRecovery(
            `after ${totalEnriched} chars`,
            2,
          );
          if (flushed) {
            lastFlushAt = totalEnriched;
          }
        } finally {
          isFlushing = false;
        }
      }
    }
  }

  // Launch CONCURRENCY workers; each drains the shared batchIdx counter
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (stopClaimingNewBatches) {
    const processedBatches = Math.min(batchIdx, totalBatches);
    const remainingBatches = Math.max(totalBatches - processedBatches, 0);
    console.warn(
      `[bulk-enrich] reached max runtime (${MAX_MINUTES}m); stopping after ${processedBatches}/${totalBatches} batches with ${remainingBatches} remaining`,
    );
  }
}

await runWorkerPool();

// Final flush for any remaining cells not yet applied
if (!DRY_RUN && allFilled.length > 0) {
  const flushed = await flushWithAdaptiveRecovery("final", 6);
  if (!flushed) {
    throw new Error(
      "Final D1 flush did not succeed after adaptive retries; exiting non-zero to signal partial completion.",
    );
  }
}

// gpt-4o-mini pricing: $0.15/1M input tokens, $0.60/1M output tokens
const estimatedCostUSD =
  (totalPromptTokens / 1_000_000) * 0.15 +
  (totalCompletionTokens / 1_000_000) * 0.6;

console.log(
  `\n[bulk-enrich] complete: ${totalEnriched} chars enriched, ${totalFailed} failed  flushes=${flushCount}` +
    `\n[bulk-enrich]   tokens: prompt=${totalPromptTokens} completion=${totalCompletionTokens}` +
    `  estimated cost: $${estimatedCostUSD.toFixed(4)}`,
);

if (totalEnriched === 0) {
  process.exit(totalFailed > 0 ? 1 : 0);
}
