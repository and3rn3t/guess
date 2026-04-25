#!/usr/bin/env -S npx tsx
/**
 * Compare two simulation JSONL result files and print a diff table.
 *
 * Usage (standalone):
 *   npx tsx scripts/simulate/compare.ts before.jsonl after.jsonl
 *
 * Or via run.ts short-circuit:
 *   pnpm simulate --compare scripts/simulate/data/results-v7.jsonl scripts/simulate/data/results-v8.jsonl
 *
 * Output columns:
 *   Metric | Before | After | Delta | Direction
 */

import * as fs from "fs";
import * as readline from "readline";

// ── Types (mirrored from engine.ts) ──────────────────────────────────────────

interface SimGameResult {
  runId: string;
  targetCharacterId: string;
  targetCharacterName: string;
  won: boolean;
  questionsAsked: number;
  guessesUsed: number;
  guessTrigger: string | null;
  forcedGuess: boolean;
  confidenceAtGuess: number | null;
  gapAtGuess: number | null;
  aliveCountAtGuess: number | null;
  secondBestProbability: number | null;
  characterPoolSize: number;
  maxQuestions: number;
  difficulty: string;
  noise?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function loadResults(filePath: string): Promise<SimGameResult[]> {
  const results: SimGameResult[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) {
      try {
        results.push(JSON.parse(trimmed) as SimGameResult);
      } catch {
        // skip malformed lines
      }
    }
  }
  return results;
}

// ── Metrics extraction ────────────────────────────────────────────────────────

interface RunMetrics {
  total: number;
  winRate: number;
  avgQuestions: number;
  medianQuestions: number;
  p90Questions: number;
  forcedGuessRate: number;
  avgConfidence: number;
  avgGap: number;
  avgAlive: number;
  triggerRates: Record<string, number>;
  noiseRate: number;
}

function extractMetrics(games: SimGameResult[]): RunMetrics {
  const total = games.length;
  const wins = games.filter((g) => g.won);
  const qCounts = games.map((g) => g.questionsAsked).sort((a, b) => a - b);
  const confVals = games.map((g) => (g.confidenceAtGuess ?? 0) * 100).filter((c) => c > 0);
  const gapVals = games.map((g) => g.gapAtGuess ?? 0).filter((v) => v > 0);
  const aliveVals = games.map((g) => g.aliveCountAtGuess ?? 0).filter((v) => v > 0);

  const triggers = new Set(games.map((g) => g.guessTrigger ?? "none"));
  const triggerRates: Record<string, number> = {};
  for (const t of triggers) {
    const count = games.filter((g) => (g.guessTrigger ?? "none") === t).length;
    triggerRates[t] = (count / total) * 100;
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const m = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[m - 1]! + arr[m]!) / 2 : arr[m]!;
  };
  const p90 = (arr: number[]) =>
    arr.length === 0 ? 0 : arr[Math.floor(arr.length * 0.9)]!;

  const noiseVals = games.map((g) => (g as { noise?: number }).noise ?? 0);
  const noiseRate = avg(noiseVals) * 100;

  return {
    total,
    winRate: (wins.length / total) * 100,
    avgQuestions: avg(qCounts),
    medianQuestions: median(qCounts),
    p90Questions: p90(qCounts),
    forcedGuessRate: (games.filter((g) => g.forcedGuess).length / total) * 100,
    avgConfidence: avg(confVals),
    avgGap: avg(gapVals) * 100,
    avgAlive: avg(aliveVals),
    triggerRates,
    noiseRate,
  };
}

// ── Comparison table ──────────────────────────────────────────────────────────

interface MetricRow {
  label: string;
  before: number;
  after: number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

function buildRows(before: RunMetrics, after: RunMetrics): MetricRow[] {
  const pctFmt = (v: number) => `${v.toFixed(1)}%`;
  const numFmt = (v: number) => v.toFixed(2);
  const intFmt = (v: number) => v.toFixed(1);

  const triggerKeys = new Set([
    ...Object.keys(before.triggerRates),
    ...Object.keys(after.triggerRates),
  ]);

  const rows: MetricRow[] = [
    { label: "Win rate",          before: before.winRate,          after: after.winRate,          format: pctFmt, higherIsBetter: true },
    { label: "Avg questions",     before: before.avgQuestions,     after: after.avgQuestions,     format: intFmt, higherIsBetter: false },
    { label: "Median questions",  before: before.medianQuestions,  after: after.medianQuestions,  format: intFmt, higherIsBetter: false },
    { label: "p90 questions",     before: before.p90Questions,     after: after.p90Questions,     format: intFmt, higherIsBetter: false },
    { label: "Forced guess rate", before: before.forcedGuessRate,  after: after.forcedGuessRate,  format: pctFmt, higherIsBetter: false },
    { label: "Avg confidence",    before: before.avgConfidence,    after: after.avgConfidence,    format: pctFmt, higherIsBetter: true },
    { label: "Avg gap",           before: before.avgGap,           after: after.avgGap,           format: pctFmt, higherIsBetter: true },
    { label: "Avg alive@guess",   before: before.avgAlive,         after: after.avgAlive,         format: numFmt, higherIsBetter: false },
  ];

  for (const t of [...triggerKeys].sort()) {
    rows.push({
      label: `  trigger:${t}`,
      before: before.triggerRates[t] ?? 0,
      after:  after.triggerRates[t] ?? 0,
      format: pctFmt,
      higherIsBetter: t === "singleton" || t === "high_certainty" || t === "strict_readiness",
    });
  }

  return rows;
}

function printComparison(
  beforePath: string,
  afterPath: string,
  before: RunMetrics,
  after: RunMetrics,
): void {
  const rows = buildRows(before, after);

  const COL_METRIC = 24;
  const COL_VAL = 12;

  console.log(`\n${"═".repeat(70)}`);
  console.log("  SIMULATION COMPARISON");
  console.log("═".repeat(70));
  console.log(`  Before: ${beforePath}  (n=${before.total}${before.noiseRate > 0 ? `, noise=${before.noiseRate.toFixed(0)}%` : ""})`);
  console.log(`  After:  ${afterPath}  (n=${after.total}${after.noiseRate > 0 ? `, noise=${after.noiseRate.toFixed(0)}%` : ""})`);
  console.log();

  const header =
    `  ${"Metric".padEnd(COL_METRIC)}` +
    `${"Before".padStart(COL_VAL)}` +
    `${"After".padStart(COL_VAL)}` +
    `${"Delta".padStart(COL_VAL)}` +
    `  Dir`;
  console.log(header);
  console.log("  " + "─".repeat(COL_METRIC + COL_VAL * 3 + 5));

  for (const row of rows) {
    const delta = row.after - row.before;
    const deltaTxt = (delta >= 0 ? "+" : "") + row.format(delta).replace("%", "") + (row.format(row.before).endsWith("%") ? "%" : "");
    const dir =
      Math.abs(delta) < 0.05
        ? "  ="
        : row.higherIsBetter === delta > 0
        ? "  ✓"
        : "  ✗";

    const line =
      `  ${row.label.padEnd(COL_METRIC)}` +
      `${row.format(row.before).padStart(COL_VAL)}` +
      `${row.format(row.after).padStart(COL_VAL)}` +
      `${deltaTxt.padStart(COL_VAL)}` +
      dir;
    console.log(line);
  }

  console.log();
  const deltaWin = after.winRate - before.winRate;
  const summary = deltaWin > 0.5
    ? `  Overall: win rate improved by +${deltaWin.toFixed(1)}pp ✓`
    : deltaWin < -0.5
    ? `  Overall: win rate degraded by ${deltaWin.toFixed(1)}pp ✗`
    : `  Overall: no meaningful change in win rate.`;
  console.log(summary);
  console.log("═".repeat(70));
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (args.length < 2) {
    console.error("Usage: compare.ts <before.jsonl> <after.jsonl>");
    process.exit(1);
  }

  const [beforePath, afterPath] = args as [string, string];

  if (!fs.existsSync(beforePath)) {
    console.error(`File not found: ${beforePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(afterPath)) {
    console.error(`File not found: ${afterPath}`);
    process.exit(1);
  }

  const [beforeResults, afterResults] = await Promise.all([
    loadResults(beforePath),
    loadResults(afterPath),
  ]);

  if (beforeResults.length === 0 || afterResults.length === 0) {
    console.error("One or both files are empty or contain no valid results.");
    process.exit(1);
  }

  const before = extractMetrics(beforeResults);
  const after = extractMetrics(afterResults);

  printComparison(beforePath, afterPath, before, after);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
