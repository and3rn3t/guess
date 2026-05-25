#!/usr/bin/env -S npx tsx
/**
 * Simulation analytics — reads one or more JSONL files of SimGameResult records
 * and prints a detailed diagnostic report.
 *
 * Single-file usage:
 *   npx tsx scripts/simulate/analyze.ts scripts/simulate/data/results-medium.jsonl
 *
 * Multi-file cross-difficulty usage (pass easy / medium / hard in any order):
 *   npx tsx scripts/simulate/analyze.ts \
 *     scripts/simulate/data/results-v4-easy.jsonl \
 *     scripts/simulate/data/results-v4-medium.jsonl \
 *     scripts/simulate/data/results-v4-hard.jsonl
 */

import * as fs from "fs";
import * as path from "path";
import { loadResults, section, type SimGameResult } from "./analyze/_shared";
import { crossDifficultyTable } from "./analyze/breakdowns";
import { analyzeResults } from "./analyze/core-stats";

// ── Main ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

// --failures mode: find characters that lost in ALL provided JSONL files
const FAILURES_MODE = argv.includes("--failures");
const filePaths = argv.filter((a) => !a.startsWith("--"));
if (filePaths.length === 0) {
  console.error("Usage: npx tsx scripts/simulate/analyze.ts [--failures] <results.jsonl> [results2.jsonl ...]");
  process.exit(1);
}

const byDifficulty = new Map<string, SimGameResult[]>();
const allResults: SimGameResult[] = [];

for (const filePath of filePaths) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  console.log(`\nLoading: ${resolved}`);
  const results = await loadResults(resolved);
  console.log(`  → ${results.length} records`);
  if (results.length === 0) {
    console.warn(`  ⚠ No valid records in ${resolved}, skipping.`);
    continue;
  }
  allResults.push(...results);
  for (const r of results) {
    const diff = r.difficulty ?? "unknown";
    if (!byDifficulty.has(diff)) byDifficulty.set(diff, []);
    byDifficulty.get(diff)!.push(r);
  }
}

if (allResults.length === 0) {
  console.error("No valid records found in any file.");
  process.exit(1);
}

console.log(`\nTotal records loaded: ${allResults.length}`);
if (byDifficulty.size > 1) {
  crossDifficultyTable(byDifficulty);
}

// --failures: cross-reference losses across all provided files
if (FAILURES_MODE) {
  if (filePaths.length < 2) {
    console.error("--failures requires at least 2 JSONL files to cross-reference.");
    process.exit(1);
  }

  section("CROSS-RUN FAILURE ANALYSIS");

  // Load each file separately to find per-file loser sets
  const perFileLosses: Set<string>[] = [];
  const idToName = new Map<string, string>();
  const idToCategory = new Map<string, string>();
  const idToLossCount = new Map<string, number>();

  for (const fp of filePaths) {
    // Re-load each file individually to get accurate per-file loss sets
    const singleFileResults = await loadResults(path.resolve(fp));
    const losers = new Set(singleFileResults.filter((r) => !r.won).map((r) => r.targetCharacterId));
    perFileLosses.push(losers);
    for (const r of singleFileResults) {
      idToName.set(r.targetCharacterId, r.targetCharacterName);
      if (r.targetCharacterCategory) idToCategory.set(r.targetCharacterId, r.targetCharacterCategory);
      if (!r.won) idToLossCount.set(r.targetCharacterId, (idToLossCount.get(r.targetCharacterId) ?? 0) + 1);
    }
  }

  // Characters that lost in ALL runs
  const allFileLosers = perFileLosses.reduce((acc, set) => {
    return new Set([...acc].filter((id) => set.has(id)));
  }, perFileLosses[0]!);

  if (allFileLosers.size === 0) {
    console.log("  No characters lost in all provided runs. Good calibration!\n");
  } else {
    console.log(`  Characters that lost in ALL ${filePaths.length} runs (persistent failures):\n`);
    console.log(`  ${"Character".padEnd(30)} ${"Category".padEnd(15)} ${"Lost In"}`)
    console.log("  " + "─".repeat(55));
    const sorted = [...allFileLosers].sort((a, b) => {
      const catA = idToCategory.get(a) ?? "";
      const catB = idToCategory.get(b) ?? "";
      return catA.localeCompare(catB) || (idToName.get(a) ?? "").localeCompare(idToName.get(b) ?? "");
    });
    for (const id of sorted) {
      const name = idToName.get(id) ?? id;
      const cat = idToCategory.get(id) ?? "unknown";
      const lossCount = idToLossCount.get(id) ?? 0;
      console.log(`  ${name.padEnd(30)} ${cat.padEnd(15)} ${lossCount}/${filePaths.length} runs`);
    }
    console.log();
    console.log(`  Tip: consider reviewing attribute coverage for these characters.`);
    console.log(`       Run \`pnpm simulate --target <id>\` to debug individually.\n`);
  }

  process.exit(0);
}

// If multiple difficulties, analyze the combined set (most useful for recommendations)
// Also note per-difficulty breakdown is in the cross-difficulty table above
analyzeResults(allResults);
