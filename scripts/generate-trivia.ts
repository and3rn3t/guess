#!/usr/bin/env npx tsx
/**
 * EN.29: Bulk trivia generation — "Did you know?" facts for every character.
 *
 * Calls OpenAI to generate up to 3 short, surprising trivia facts per character
 * and writes them as JSON arrays into `characters.trivia`. Designed to be run once
 * (or re-run incrementally — skips characters that already have trivia).
 *
 * Facts are:
 *  - Short (≤ 120 characters each), written in plain English
 *  - Surprising or non-obvious — not just "is a fictional character"
 *  - Specific to the character, not their franchise
 *  - Appropriate for all ages — no violence/spoilers
 *
 * Usage:
 *   npx tsx scripts/generate-trivia.ts
 *     [--env preview|production]   # default: production
 *     [--limit 500]                # max characters to process per run (default: 500)
 *     [--batch-size 10]            # characters per LLM call (default: 10)
 *     [--concurrency 4]            # parallel LLM calls (default: 4)
 *     [--flush-every 50]           # write to D1 every N characters (default: 50)
 *     [--dry-run]                  # skip OpenAI and D1 writes
 *     [--force]                    # re-generate trivia even for characters that already have it
 *
 * Env:
 *   OPENAI_API_KEY  — required unless --dry-run
 *   TRIVIA_MODEL    — optional override (default: gpt-4o-mini)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withRetry } from "./ingest/rate-limiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "data", "trivia");
mkdirSync(OUT_DIR, { recursive: true });

// ── Env loading ───────────────────────────────────────────────────────────────
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

// ── CLI flags ─────────────────────────────────────────────────────────────────
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const ENV_FLAG = flag("--env", "production");
const LIMIT = Number.parseInt(flag("--limit", "500"), 10);
const BATCH_SIZE = Number.parseInt(flag("--batch-size", "10"), 10);
const CONCURRENCY = Number.parseInt(flag("--concurrency", "4"), 10);
const FLUSH_EVERY = Number.parseInt(flag("--flush-every", "50"), 10);
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const DB_NAME = ENV_FLAG === "production" ? "guess-db" : "guess-db-preview";
const MODEL = process.env.TRIVIA_MODEL ?? "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const RUN_ISO = new Date().toISOString();

console.log(
  `[generate-trivia] env=${ENV_FLAG} limit=${LIMIT} batch-size=${BATCH_SIZE} concurrency=${CONCURRENCY} flush-every=${FLUSH_EVERY} dry-run=${DRY_RUN} force=${FORCE}`,
);
console.log(`[generate-trivia] model=${MODEL}  run=${RUN_ISO}`);

// ── D1 helpers ────────────────────────────────────────────────────────────────
function d1<T>(sql: string): T[] {
  const out = execFileSync(
    "npx",
    [
      "wrangler",
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
    { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 },
  );
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>;
  return parsed[0]?.results ?? [];
}

function d1ApplyFile(filePath: string): void {
  execFileSync(
    "npx",
    [
      "wrangler",
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
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CharRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface TriviaResult {
  id: string;
  trivia: string[];
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

// ── Load target characters from D1 ───────────────────────────────────────────
const triviaFilter = FORCE ? "" : "AND (trivia IS NULL OR trivia = '')";
console.log(
  `[generate-trivia] loading up to ${LIMIT} characters${FORCE ? " (force mode — including existing trivia)" : " without trivia"} ...`,
);

const pendingChars = d1<CharRow>(
  `SELECT id, name, category, description FROM characters
   WHERE 1=1 ${triviaFilter}
   ORDER BY popularity DESC
   LIMIT ${LIMIT}`,
);

console.log(`[generate-trivia]   ${pendingChars.length} characters to process`);

if (pendingChars.length === 0) {
  console.log(
    "[generate-trivia] all characters already have trivia — exiting. Use --force to re-generate.",
  );
  process.exit(0);
}

// ── LLM prompt ────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a knowledgeable assistant that writes surprising, educational trivia facts about fictional characters.

For each character provided, return exactly 3 short trivia facts in JSON format.

RULES:
- Each fact must be ≤ 120 characters
- Facts must be specific to the character, not their franchise or author
- Facts should be surprising, non-obvious, and interesting
- Written in plain English, present tense, starting with the character's name
- Appropriate for all ages — no violence, death, or spoilers for major plot twists
- If you lack sufficient specific knowledge, return fewer facts (1 or 2) rather than inventing details
- Return null for characters you have no reliable knowledge about

RESPONSE FORMAT (strict JSON):
{
  "character_id": ["fact 1", "fact 2", "fact 3"],
  "character_id_2": ["fact 1", "fact 2"],
  "unknown_character_id": null
}`;

function buildUserPrompt(chars: CharRow[]): string {
  const lines = chars.map((c) => {
    const desc = c.description ? ` — ${c.description.slice(0, 150)}` : "";
    return `- ${c.id}: "${c.name}" (${c.category})${desc}`;
  });
  return `Generate trivia facts for these characters:\n\n${lines.join("\n")}`;
}

// ── OpenAI call ───────────────────────────────────────────────────────────────
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && !DRY_RUN) {
  console.error(
    "[generate-trivia] OPENAI_API_KEY not set — pass --dry-run to test without API.",
  );
  process.exit(3);
}

async function callLLMBatch(chars: CharRow[]): Promise<{
  results: TriviaResult[];
  promptTokens: number;
  completionTokens: number;
}> {
  const userPrompt = buildUserPrompt(chars);

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4, // slightly higher than enrichment for varied, interesting facts
          response_format: { type: "json_object" },
          // 10 chars × 3 facts × ~25 tokens/fact + JSON overhead = ~900 tokens max
          max_tokens: 2048,
        }),
      }).then((r) => {
        if (r.status === 429 || r.status >= 500) {
          return r.text().then((body) => {
            throw new Error(`OpenAI ${r.status}: ${body.slice(0, 400)}`);
          });
        }
        return r;
      }),
    3,
    2000,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as OpenAIResponse;
  const content = json.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  let parsed: Record<string, string[] | null>;
  try {
    parsed = JSON.parse(content) as Record<string, string[] | null>;
  } catch {
    throw new Error(`LLM response was not valid JSON: ${content.slice(0, 200)}`);
  }

  const results: TriviaResult[] = [];
  for (const char of chars) {
    const facts = parsed[char.id];
    if (!Array.isArray(facts)) continue; // null or missing — skip
    const cleaned = facts
      .filter((f): f is string => typeof f === "string")
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.length <= 120)
      .slice(0, 3);
    if (cleaned.length === 0) continue;
    results.push({ id: char.id, trivia: cleaned });
  }

  return {
    results,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}

// ── Flush helper ──────────────────────────────────────────────────────────────
const allResults: TriviaResult[] = [];
let flushCount = 0;
let totalProcessed = 0;
let totalWritten = 0;
let totalFailed = 0;
let totalPromptTokens = 0;
let totalCompletionTokens = 0;

const sqlEscape = (s: string): string => s.replaceAll("'", "''");

async function flushAndApply(label: string): Promise<void> {
  if (allResults.length === 0) return;
  const batch = allResults.splice(0, allResults.length);
  const flushIdx = ++flushCount;
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\..*/, "");
  const outFile = path.join(
    OUT_DIR,
    `trivia-${ENV_FLAG}-${stamp}-flush${flushIdx}.sql`,
  );

  const sqlLines = [
    `-- Generated by scripts/generate-trivia.ts (flush ${flushIdx}) — ${label}`,
    `-- env=${ENV_FLAG} model=${MODEL} run=${RUN_ISO}`,
  ];
  for (const row of batch) {
    const json = sqlEscape(JSON.stringify(row.trivia));
    sqlLines.push(
      `UPDATE characters SET trivia = '${json}' WHERE id = '${sqlEscape(row.id)}';`,
    );
  }

  writeFileSync(outFile, sqlLines.join("\n"));
  console.log(
    `[generate-trivia] flush #${flushIdx}: ${batch.length} characters → ${path.basename(outFile)}`,
  );
  d1ApplyFile(outFile);
  totalWritten += batch.length;
  console.log(
    `[generate-trivia] flush #${flushIdx}: applied to D1 (${totalWritten} total written)`,
  );
}

// ── Worker pool ───────────────────────────────────────────────────────────────
const batches: CharRow[][] = [];
for (let i = 0; i < pendingChars.length; i += BATCH_SIZE) {
  batches.push(pendingChars.slice(i, i + BATCH_SIZE));
}

console.log(
  `\n[generate-trivia] ${batches.length} batches (${BATCH_SIZE} chars/batch, ${CONCURRENCY} parallel)\n`,
);

async function runWorkerPool(): Promise<void> {
  let batchIdx = 0;
  let isFlushing = false;
  let lastFlushAt = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = batchIdx++;
      if (idx >= batches.length) break;
      const chars = batches[idx];
      const label = `batch ${idx + 1}/${batches.length}`;

      if (DRY_RUN) {
        console.log(
          `[generate-trivia] ${label} (dry-run): would process ${chars.length} chars`,
        );
        totalProcessed += chars.length;
        continue;
      }

      try {
        const { results, promptTokens, completionTokens } =
          await callLLMBatch(chars);
        allResults.push(...results);
        totalPromptTokens += promptTokens;
        totalCompletionTokens += completionTokens;
        totalProcessed += chars.length;
        const skipped = chars.length - results.length;
        console.log(
          `[generate-trivia] ${label} done — ${results.length}/${chars.length} with facts` +
            (skipped > 0 ? ` (${skipped} skipped — no knowledge)` : "") +
            `  tokens: +${promptTokens}p +${completionTokens}c`,
        );
      } catch (err) {
        console.error(
          `[generate-trivia] ${label} FAILED: ${(err as Error).message}`,
        );
        totalFailed += chars.length;
      }

      if (
        !isFlushing &&
        totalProcessed - lastFlushAt >= FLUSH_EVERY &&
        allResults.length > 0
      ) {
        isFlushing = true;
        lastFlushAt = totalProcessed;
        try {
          await flushAndApply(`after ${totalProcessed} chars`);
        } finally {
          isFlushing = false;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker()),
  );
}

await runWorkerPool();

// Final flush
if (!DRY_RUN && allResults.length > 0) {
  await flushAndApply("final");
}

// ── Summary ───────────────────────────────────────────────────────────────────
const totalCost =
  (totalPromptTokens / 1_000_000) * 0.15 +
  (totalCompletionTokens / 1_000_000) * 0.6; // gpt-4o-mini pricing

console.log(`
[generate-trivia] ─────────────────────────────
  processed : ${totalProcessed}
  written   : ${totalWritten}
  failed    : ${totalFailed}
  tokens    : ${totalPromptTokens} prompt + ${totalCompletionTokens} completion
  est. cost : $${totalCost.toFixed(4)} (gpt-4o-mini)
  flushes   : ${flushCount}
[generate-trivia] done.`);
