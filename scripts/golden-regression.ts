/**
 * DQ.1 — Golden character regression harness.
 *
 * Loads `data/data-quality-golden.json`, runs the production enrichment prompt
 * (same `buildSystemPrompt` + `buildUserPrompt` as `scripts/ingest/enrich.ts`)
 * against each character, compares the model's answers to the curator's
 * expected values, and exits non-zero when total deviation exceeds
 * `thresholdPct`.
 *
 * Usage:
 *   pnpm golden:regression                # Live LLM run; needs OPENAI_API_KEY
 *   pnpm golden:regression --schema-only  # No network; just validate the JSON
 *   pnpm golden:regression --json out.json # Also write a machine-readable report
 *
 * Exit codes:
 *   0 — all checks pass (or schema-only succeeded)
 *   1 — golden set malformed
 *   2 — deviation exceeds threshold
 *   3 — missing OPENAI_API_KEY
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSystemPrompt,
  buildUserPrompt,
  loadAttributeDefinitions,
  type AttributeDef,
} from './ingest/enrich.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/** Match the loader convention in `scripts/ingest/config.ts` — `.env.local` then `.dev.vars`. */
function loadEnvFiles(): void {
  for (const file of ['.env.local', '.dev.vars']) {
    const p = path.join(REPO_ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadEnvFiles();

const GOLDEN_PATH = path.join(REPO_ROOT, 'data', 'data-quality-golden.json');
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.GOLDEN_MODEL ?? 'gpt-4o-mini';

interface GoldenCharacter {
  id: string;
  name: string;
  category: string;
  description: string;
  expected: Record<string, boolean>;
}

interface GoldenSet {
  version: number;
  thresholdPct: number;
  characters: GoldenCharacter[];
}

function parseArgs(): { schemaOnly: boolean; jsonOut: string | null } {
  const argv = process.argv.slice(2);
  const schemaOnly = argv.includes('--schema-only');
  const jsonIdx = argv.findIndex((a) => a === '--json');
  const jsonOut = jsonIdx >= 0 ? (argv[jsonIdx + 1] ?? null) : null;
  return { schemaOnly, jsonOut };
}

function loadGolden(attrKeys: Set<string>): GoldenSet {
  if (!existsSync(GOLDEN_PATH)) {
    throw new Error(`Golden set missing: ${GOLDEN_PATH}`);
  }
  const raw = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as GoldenSet;

  if (!Array.isArray(raw.characters) || raw.characters.length === 0) {
    throw new Error('Golden set has no characters');
  }
  if (typeof raw.thresholdPct !== 'number' || raw.thresholdPct < 0 || raw.thresholdPct > 100) {
    throw new Error(`Invalid thresholdPct: ${raw.thresholdPct}`);
  }

  const ids = new Set<string>();
  const errors: string[] = [];
  for (const c of raw.characters) {
    if (!c.id || !c.name || !c.category || !c.description) {
      errors.push(`Character missing required field: ${JSON.stringify(c).slice(0, 80)}`);
      continue;
    }
    if (ids.has(c.id)) errors.push(`Duplicate id: ${c.id}`);
    ids.add(c.id);
    if (!c.expected || Object.keys(c.expected).length === 0) {
      errors.push(`${c.id}: empty expected{}`);
      continue;
    }
    for (const [k, v] of Object.entries(c.expected)) {
      if (!attrKeys.has(k)) errors.push(`${c.id}: unknown attribute key "${k}"`);
      if (typeof v !== 'boolean') errors.push(`${c.id}.${k}: expected boolean, got ${typeof v}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Golden set validation failed:\n  - ${errors.join('\n  - ')}`);
  }
  return raw;
}

interface OpenAIResponse {
  choices: { message: { content: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<Record<string, Record<string, boolean | null>>> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as OpenAIResponse;
  const content = json.choices[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');
  return JSON.parse(content) as Record<string, Record<string, boolean | null>>;
}

interface FrameResult {
  id: string;
  name: string;
  total: number;
  correct: number;
  wrong: { key: string; expected: boolean; actual: boolean | null }[];
}

interface RegressionReport {
  model: string;
  thresholdPct: number;
  totalCells: number;
  correctCells: number;
  wrongCells: number;
  accuracyPct: number;
  deviationPct: number;
  passed: boolean;
  perCharacter: FrameResult[];
}

function score(
  golden: GoldenSet,
  responses: Record<string, Record<string, boolean | null>>,
): Omit<RegressionReport, 'model' | 'thresholdPct' | 'passed'> {
  const perCharacter: FrameResult[] = [];
  let total = 0;
  let correct = 0;

  for (const char of golden.characters) {
    const got = responses[char.id] ?? {};
    const expectedKeys = Object.keys(char.expected);
    const wrong: FrameResult['wrong'] = [];
    let charCorrect = 0;
    for (const k of expectedKeys) {
      const expected = char.expected[k];
      const actual = got[k] ?? null;
      if (actual === expected) {
        charCorrect++;
      } else {
        wrong.push({ key: k, expected, actual });
      }
    }
    perCharacter.push({
      id: char.id,
      name: char.name,
      total: expectedKeys.length,
      correct: charCorrect,
      wrong,
    });
    total += expectedKeys.length;
    correct += charCorrect;
  }

  const accuracyPct = total === 0 ? 0 : (correct / total) * 100;
  return {
    totalCells: total,
    correctCells: correct,
    wrongCells: total - correct,
    accuracyPct,
    deviationPct: 100 - accuracyPct,
    perCharacter,
  };
}

function printSummary(report: RegressionReport): void {
  const status = report.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`\n${status} — golden regression vs ${report.model}`);
  console.log(
    `  cells: ${report.correctCells}/${report.totalCells} correct  ·  ` +
      `accuracy ${report.accuracyPct.toFixed(2)}%  ·  ` +
      `deviation ${report.deviationPct.toFixed(2)}%  ·  ` +
      `threshold ${report.thresholdPct.toFixed(2)}%`,
  );
  const failing = report.perCharacter.filter((c) => c.wrong.length > 0);
  if (failing.length === 0) {
    console.log('  All characters match expected attributes.');
    return;
  }
  console.log(`\n  Mismatches (${failing.length} characters):`);
  for (const c of failing) {
    console.log(`    • ${c.name} (${c.id}) — ${c.correct}/${c.total} correct`);
    for (const w of c.wrong) {
      console.log(`        ${w.key}: expected ${w.expected}, got ${w.actual}`);
    }
  }
}

async function main(): Promise<void> {
  const { schemaOnly, jsonOut } = parseArgs();

  const defs: AttributeDef[] = loadAttributeDefinitions();
  const attrKeys = defs.map((d) => d.key);
  const attrKeySet = new Set(attrKeys);

  let golden: GoldenSet;
  try {
    golden = loadGolden(attrKeySet);
  } catch (e) {
    console.error(`\x1b[31m✗\x1b[0m ${(e as Error).message}`);
    process.exit(1);
  }

  const totalCells = golden.characters.reduce((n, c) => n + Object.keys(c.expected).length, 0);
  console.log(
    `Loaded ${golden.characters.length} golden characters · ${totalCells} asserted cells · threshold ±${golden.thresholdPct}%`,
  );

  if (schemaOnly) {
    console.log('\x1b[32m✓\x1b[0m Schema-only check passed.');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      '\x1b[31m✗\x1b[0m OPENAI_API_KEY is not set. Either export it or run with --schema-only.',
    );
    process.exit(3);
  }

  const systemPrompt = buildSystemPrompt(attrKeys);
  // Run characters in batches of 5 to mirror production batch size and reduce
  // per-call overhead.
  const BATCH_SIZE = 5;
  const responses: Record<string, Record<string, boolean | null>> = {};
  for (let i = 0; i < golden.characters.length; i += BATCH_SIZE) {
    const batch = golden.characters.slice(i, i + BATCH_SIZE);
    const userPrompt = buildUserPrompt(
      batch.map((c) => ({ id: c.id, name: c.name, category: c.category, description: c.description })),
    );
    process.stdout.write(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(golden.characters.length / BATCH_SIZE)}…`);
    const result = await callLLM(systemPrompt, userPrompt, apiKey);
    Object.assign(responses, result);
    process.stdout.write(' ok\n');
  }

  const scored = score(golden, responses);
  const passed = scored.deviationPct <= golden.thresholdPct;
  const report: RegressionReport = {
    model: MODEL,
    thresholdPct: golden.thresholdPct,
    passed,
    ...scored,
  };

  printSummary(report);

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2));
    console.log(`\n  report written to ${jsonOut}`);
  }

  if (!passed) {
    console.error(
      `\n\x1b[31m✗\x1b[0m Deviation ${report.deviationPct.toFixed(2)}% exceeds threshold ${report.thresholdPct}%.`,
    );
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
