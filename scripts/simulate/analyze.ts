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
import * as readline from "readline";
import * as path from "path";

// ── Types mirrored from engine.ts ─────────────────────────────────────────────

interface SimQuestionStep {
  attribute: string;
  answer: "yes" | "no" | "maybe" | "unknown";
  infoGain: number;
}

interface SimGameResult {
  runId: string;
  targetCharacterId: string;
  targetCharacterName: string;
  targetCharacterCategory?: string | null;
  won: boolean;
  questionsAsked: number;
  guessesUsed: number;
  guessTrigger: string | null;
  forcedGuess: boolean;
  confidenceAtGuess: number | null;
  entropyAtGuess: number | null;
  gapAtGuess: number | null;
  aliveCountAtGuess: number | null;
  secondBestCharacterId: string | null;
  secondBestCharacterName: string | null;
  secondBestProbability: number | null;
  questionsSequence: SimQuestionStep[];
  answerDistribution: Record<"yes" | "no" | "maybe" | "unknown", number>;
  characterPoolSize: number;
  maxQuestions: number;
  difficulty: string;
  createdAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${((n / total) * 100).toFixed(1)}%`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function p90(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.9)];
}

function bar(n: number, total: number, width = 30): string {
  const fill = total === 0 ? 0 : Math.round((n / total) * width);
  return "█".repeat(fill) + "░".repeat(width - fill);
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function section(title: string): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function subsection(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 65 - title.length))}`);
}

// ── Load JSONL ────────────────────────────────────────────────────────────────

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

// ── Analytics ─────────────────────────────────────────────────────────────────

function analyzeResults(games: SimGameResult[]): void {
  const total = games.length;
  const wins = games.filter((g) => g.won);
  const losses = games.filter((g) => !g.won);

  // ── 1. Overview ──────────────────────────────────────────────────────────────
  section("1. OVERVIEW");

  const winRate = (wins.length / total) * 100;
  const qCounts = games.map((g) => g.questionsAsked);
  const confValues = wins
    .map((g) => (g.confidenceAtGuess ?? 0) * 100)
    .filter((c) => c > 0);
  const gapValues = wins
    .map((g) => g.gapAtGuess ?? 0)
    .filter((g) => g > 0);
  const aliveAtGuess = games
    .map((g) => g.aliveCountAtGuess ?? 0)
    .filter((a) => a > 0);

  console.log(`  Total games   : ${total}`);
  console.log(`  Wins          : ${wins.length}  (${fmt(winRate)}%)`);
  console.log(`  Losses        : ${losses.length}  (${fmt(100 - winRate)}%)`);
  console.log(`  Avg questions : ${fmt(avg(qCounts))}`);
  console.log(`  Median q's    : ${fmt(median(qCounts))}`);
  console.log(`  p90 questions : ${fmt(p90(qCounts))}`);
  console.log(`  Avg confidence: ${fmt(avg(confValues))}%`);
  console.log(`  Median conf   : ${fmt(median(confValues))}%`);
  console.log(`  Avg gap       : ${fmt(avg(gapValues) * 100)}%`);
  console.log(`  Avg alive@guess: ${fmt(avg(aliveAtGuess))}`);

  // ── 1.5. Per-character difficulty clustering ──────────────────────────────────
  characterDifficultyClustering(games);

  // ── 1.6. Category breakdown ───────────────────────────────────────────────────
  categoryBreakdown(games);

  // ── 2. Trigger breakdown ─────────────────────────────────────────────────────
  section("2. GUESS TRIGGER BREAKDOWN");

  const triggers = new Map<string, { count: number; wins: number; totalQ: number; totalConf: number }>();
  for (const g of games) {
    const t = g.guessTrigger ?? "none";
    const e = triggers.get(t) ?? { count: 0, wins: 0, totalQ: 0, totalConf: 0 };
    e.count++;
    if (g.won) e.wins++;
    e.totalQ += g.questionsAsked;
    e.totalConf += (g.confidenceAtGuess ?? 0) * 100;
    triggers.set(t, e);
  }

  console.log(
    `  ${"Trigger".padEnd(20)} ${"Count".padStart(6)} ${"Win%".padStart(7)} ${"AvgQ".padStart(6)} ${"AvgConf".padStart(8)}`
  );
  console.log("  " + "─".repeat(50));
  for (const [trigger, stats] of [...triggers.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const winPct = ((stats.wins / stats.count) * 100).toFixed(1);
    const avgQ = (stats.totalQ / stats.count).toFixed(1);
    const avgConf = (stats.totalConf / stats.count).toFixed(1);
    console.log(
      `  ${trigger.padEnd(20)} ${String(stats.count).padStart(6)} ${(winPct + "%").padStart(7)} ${avgQ.padStart(6)} ${(avgConf + "%").padStart(8)}`
    );
  }

  // ── 3. Confidence distribution ───────────────────────────────────────────────
  section("3. CONFIDENCE AT GUESS (wins only)");

  const confBuckets = [
    { label: "0–10%", min: 0, max: 0.10 },
    { label: "10–25%", min: 0.10, max: 0.25 },
    { label: "25–40%", min: 0.25, max: 0.40 },
    { label: "40–60%", min: 0.40, max: 0.60 },
    { label: "60–80%", min: 0.60, max: 0.80 },
    { label: "80–93%", min: 0.80, max: 0.93 },
    { label: "93%+", min: 0.93, max: 1.01 },
  ];

  for (const bucket of confBuckets) {
    const bucketWins = wins.filter((g) => {
      const c = g.confidenceAtGuess ?? 0;
      return c >= bucket.min && c < bucket.max;
    });
    const count = bucketWins.length;
    console.log(
      `  ${bucket.label.padEnd(8)} ${bar(count, wins.length)} ${String(count).padStart(5)} (${pct(count, wins.length)})`
    );
  }

  // ── 4. Questions distribution ────────────────────────────────────────────────
  section("4. QUESTIONS ASKED DISTRIBUTION");

  const qBuckets = [
    { label: "≤15", min: 0, max: 16 },
    { label: "16–30", min: 16, max: 31 },
    { label: "31–50", min: 31, max: 51 },
    { label: "51–80", min: 51, max: 81 },
    { label: "81–120", min: 81, max: 121 },
    { label: "121–180", min: 121, max: 181 },
    { label: "181+", min: 181, max: Infinity },
  ];

  for (const bucket of qBuckets) {
    const count = games.filter((g) => g.questionsAsked >= bucket.min && g.questionsAsked < bucket.max).length;
    const wonCount = games.filter(
      (g) => g.questionsAsked >= bucket.min && g.questionsAsked < bucket.max && g.won
    ).length;
    console.log(
      `  ${bucket.label.padEnd(8)} ${bar(count, total)} ${String(count).padStart(5)} (${pct(count, total)}, ${pct(wonCount, count)} win)`
    );
  }

  // ── 5. Alive count at guess distribution ─────────────────────────────────────
  section("5. ALIVE COUNT AT GUESS");

  const aliveBuckets = [
    { label: "1", min: 0, max: 2 },
    { label: "2", min: 2, max: 3 },
    { label: "3–5", min: 3, max: 6 },
    { label: "6–10", min: 6, max: 11 },
    { label: "11–25", min: 11, max: 26 },
    { label: "26–50", min: 26, max: 51 },
    { label: "51–100", min: 51, max: 101 },
    { label: "101+", min: 101, max: Infinity },
  ];

  console.log(
    `  Note: "alive" = characters with posterior > 0.001 at guess time`
  );
  for (const bucket of aliveBuckets) {
    const count = games.filter((g) => {
      const a = g.aliveCountAtGuess ?? 0;
      return a >= bucket.min && a < bucket.max;
    }).length;
    const wonCount = games.filter((g) => {
      const a = g.aliveCountAtGuess ?? 0;
      return a >= bucket.min && a < bucket.max && g.won;
    }).length;
    console.log(
      `  ${bucket.label.padEnd(8)} ${bar(count, total)} ${String(count).padStart(5)} (${pct(count, total)}, ${pct(wonCount, count)} win)`
    );
  }

  // ── 6. Information gain per question ─────────────────────────────────────────
  section("6. INFORMATION GAIN PER ATTRIBUTE (top 25 and bottom 25)");

  const attrInfoGain = new Map<string, { total: number; count: number; unknownCount: number }>();
  for (const game of games) {
    for (const step of game.questionsSequence) {
      const e = attrInfoGain.get(step.attribute) ?? { total: 0, count: 0, unknownCount: 0 };
      e.total += step.infoGain;
      e.count++;
      if (step.answer === "unknown") e.unknownCount++;
      attrInfoGain.set(step.attribute, e);
    }
  }

  const attrRanked = [...attrInfoGain.entries()]
    .map(([attr, { total, count, unknownCount }]) => {
      const avgGain = total / count;
      const unknownRate = unknownCount / count;
      const netGain = avgGain * (1 - unknownRate);
      return { attr, avgGain, unknownRate, netGain, count };
    })
    .sort((a, b) => b.netGain - a.netGain);

  // ASCII heatmap: 5 tiers based on netGain relative to the top value
  const maxNetGain = attrRanked[0]?.netGain ?? 1;
  function gainBar(value: number): string {
    const ratio = maxNetGain > 0 ? value / maxNetGain : 0;
    if (ratio >= 0.80) return "████";
    if (ratio >= 0.60) return "▓▓▓▓";
    if (ratio >= 0.40) return "▒▒▒▒";
    if (ratio >= 0.20) return "░░░░";
    return "····";
  }

  subsection("Top 25 Most Discriminating Attributes (by net gain)");
  console.log(
    `  ${"Attribute".padEnd(36)} ${"Heat"} ${"AvgGain".padStart(9)} ${"Null%".padStart(6)} ${"NetGain".padStart(9)} ${"Asked".padStart(6)}`
  );
  console.log("  " + "─".repeat(76));
  for (const { attr, avgGain, unknownRate, netGain, count } of attrRanked.slice(0, 25)) {
    console.log(
      `  ${attr.padEnd(36)} ${gainBar(netGain)} ${fmt(avgGain, 4).padStart(9)} ${(unknownRate * 100).toFixed(0).padStart(5)}% ${fmt(netGain, 4).padStart(9)} ${String(count).padStart(6)}`
    );
  }

  subsection("Bottom 25 Least Discriminating Attributes (asked ≥5 times, by net gain)");
  console.log(
    `  ${"Attribute".padEnd(36)} ${"Heat"} ${"AvgGain".padStart(9)} ${"Null%".padStart(6)} ${"NetGain".padStart(9)} ${"Asked".padStart(6)}`
  );
  console.log("  " + "─".repeat(76));
  const bottom = attrRanked.filter((a) => a.count >= 5).slice(-25).reverse();
  for (const { attr, avgGain, unknownRate, netGain, count } of bottom) {
    console.log(
      `  ${attr.padEnd(36)} ${gainBar(netGain)} ${fmt(avgGain, 4).padStart(9)} ${(unknownRate * 100).toFixed(0).padStart(5)}% ${fmt(netGain, 4).padStart(9)} ${String(count).padStart(6)}`
    );
  }

  // ── 6.5. Question selection quality by slot ───────────────────────────────────
  questionSelectionQuality(games);

  // ── 7. Answer distribution ───────────────────────────────────────────────────
  section("7. ANSWER DISTRIBUTION");

  const totalDist = { yes: 0, no: 0, maybe: 0, unknown: 0 };
  for (const g of games) {
    totalDist.yes += g.answerDistribution.yes ?? 0;
    totalDist.no += g.answerDistribution.no ?? 0;
    totalDist.maybe += g.answerDistribution.maybe ?? 0;
    totalDist.unknown += g.answerDistribution.unknown ?? 0;
  }
  const totalAnswers = totalDist.yes + totalDist.no + totalDist.maybe + totalDist.unknown;

  console.log(`  Total answers: ${totalAnswers}`);
  for (const key of ["yes", "no", "maybe", "unknown"] as const) {
    const n = totalDist[key];
    console.log(
      `  ${key.padEnd(10)} ${bar(n, totalAnswers)} ${String(n).padStart(7)} (${pct(n, totalAnswers)})`
    );
  }

  // High unknown rate per attribute
  subsection("Attributes with highest 'unknown' answer rate (≥10 times asked)");
  const attrAnswers = new Map<string, Record<"yes" | "no" | "maybe" | "unknown", number>>();
  for (const game of games) {
    for (const step of game.questionsSequence) {
      const e = attrAnswers.get(step.attribute) ?? { yes: 0, no: 0, maybe: 0, unknown: 0 };
      e[step.answer]++;
      attrAnswers.set(step.attribute, e);
    }
  }
  const highUnknown = [...attrAnswers.entries()]
    .map(([attr, dist]) => {
      const tot = dist.yes + dist.no + dist.maybe + dist.unknown;
      return { attr, unknownRate: dist.unknown / tot, total: tot };
    })
    .filter((a) => a.total >= 10)
    .sort((a, b) => b.unknownRate - a.unknownRate)
    .slice(0, 20);

  console.log(
    `  ${"Attribute".padEnd(40)} ${"Unknown%".padStart(9)} ${"Asked".padStart(6)}`
  );
  console.log("  " + "─".repeat(58));
  for (const { attr, unknownRate, total } of highUnknown) {
    console.log(
      `  ${attr.padEnd(40)} ${(fmt(unknownRate * 100) + "%").padStart(9)} ${String(total).padStart(6)}`
    );
  }

  // ── 8. Wrong-guess analysis ──────────────────────────────────────────────────
  section("8. WRONG GUESSES (guessesUsed > 1)");

  const wrongGuessGames = games.filter((g) => g.guessesUsed > 1);
  const byGuessCount = new Map<number, number>();
  for (const g of wrongGuessGames) {
    byGuessCount.set(g.guessesUsed, (byGuessCount.get(g.guessesUsed) ?? 0) + 1);
  }

  console.log(`  Games with ≥2 guesses: ${wrongGuessGames.length} (${pct(wrongGuessGames.length, total)})`);
  for (const [count, freq] of [...byGuessCount.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${count} guesses: ${freq} games`);
  }

  // ── 9. Hard characters (high question count) ──────────────────────────────────
  section("9. HARDEST CHARACTERS (top 20 by questions asked)");

  const hardGames = [...games].sort((a, b) => b.questionsAsked - a.questionsAsked).slice(0, 20);
  console.log(
    `  ${"Character".padEnd(40)} ${"Q#".padStart(4)} ${"Conf".padStart(6)} ${"Alive".padStart(6)} ${"Won".padStart(5)} ${"Trigger".padStart(16)}`
  );
  console.log("  " + "─".repeat(80));
  for (const g of hardGames) {
    const conf = g.confidenceAtGuess !== null ? fmt(g.confidenceAtGuess * 100) + "%" : "—";
    const alive = g.aliveCountAtGuess !== null ? String(g.aliveCountAtGuess) : "—";
    console.log(
      `  ${g.targetCharacterName.padEnd(40)} ${String(g.questionsAsked).padStart(4)} ${conf.padStart(6)} ${alive.padStart(6)} ${(g.won ? "✓" : "✗").padStart(5)} ${(g.guessTrigger ?? "—").padStart(16)}`
    );
  }

  // ── 10. Losses analysis ───────────────────────────────────────────────────────
  section("10. LOSSES ANALYSIS");

  if (losses.length === 0) {
    console.log("  No losses! Perfect run.");
  } else {
    console.log(`  ${losses.length} losses:`);
    console.log(
      `  ${"Character".padEnd(40)} ${"Q#".padStart(4)} ${"Conf".padStart(6)} ${"Alive".padStart(6)} ${"Trigger".padStart(16)}`
    );
    console.log("  " + "─".repeat(74));
    for (const g of losses) {
      const conf = g.confidenceAtGuess !== null ? fmt(g.confidenceAtGuess * 100) + "%" : "—";
      const alive = g.aliveCountAtGuess !== null ? String(g.aliveCountAtGuess) : "—";
      console.log(
        `  ${g.targetCharacterName.padEnd(40)} ${String(g.questionsAsked).padStart(4)} ${conf.padStart(6)} ${alive.padStart(6)} ${(g.guessTrigger ?? "—").padStart(16)}`
      );
    }
  }

  // ── 11. Low-confidence wins ───────────────────────────────────────────────────
  section("11. LOW-CONFIDENCE WINS (conf < 20%)");

  const lowConfWins = wins
    .filter((g) => (g.confidenceAtGuess ?? 1) < 0.20)
    .sort((a, b) => (a.confidenceAtGuess ?? 0) - (b.confidenceAtGuess ?? 0));

  console.log(`  Count: ${lowConfWins.length} (${pct(lowConfWins.length, wins.length)} of wins)`);
  if (lowConfWins.length > 0) {
    subsection("Lowest confidence wins (up to 20)");
    console.log(
      `  ${"Character".padEnd(40)} ${"Conf".padStart(6)} ${"Q#".padStart(4)} ${"Alive".padStart(6)} ${"2nd Best".padEnd(25)} ${"Trigger".padStart(16)}`
    );
    console.log("  " + "─".repeat(98));
    for (const g of lowConfWins.slice(0, 20)) {
      const conf = g.confidenceAtGuess !== null ? fmt(g.confidenceAtGuess * 100) + "%" : "—";
      const alive = g.aliveCountAtGuess !== null ? String(g.aliveCountAtGuess) : "—";
      const second = g.secondBestCharacterName ?? "—";
      console.log(
        `  ${g.targetCharacterName.padEnd(40)} ${conf.padStart(6)} ${String(g.questionsAsked).padStart(4)} ${alive.padStart(6)} ${second.padEnd(25)} ${(g.guessTrigger ?? "—").padStart(16)}`
      );
    }
  }

  // ── 12. Question usage frequency ─────────────────────────────────────────────
  section("12. QUESTION USAGE FREQUENCY");

  const attrUsage = new Map<string, number>();
  for (const game of games) {
    for (const step of game.questionsSequence) {
      attrUsage.set(step.attribute, (attrUsage.get(step.attribute) ?? 0) + 1);
    }
  }

  const usageRanked = [...attrUsage.entries()].sort((a, b) => b[1] - a[1]);
  const usedCount = usageRanked.length;
  console.log(`  Unique attributes used: ${usedCount}`);

  subsection("Top 25 most frequently asked attributes");
  console.log(
    `  ${"Attribute".padEnd(40)} ${"Times".padStart(6)} ${"AvgGain".padStart(8)}`
  );
  console.log("  " + "─".repeat(57));
  for (const [attr, count] of usageRanked.slice(0, 25)) {
    const gainData = attrInfoGain.get(attr);
    const avgGain = gainData ? gainData.total / gainData.count : 0;
    console.log(
      `  ${attr.padEnd(40)} ${String(count).padStart(6)} ${fmt(avgGain, 4).padStart(8)}`
    );
  }

  subsection("Bottom 10 least frequently asked attributes (asked at least once)");
  console.log(
    `  ${"Attribute".padEnd(40)} ${"Times".padStart(6)}`
  );
  console.log("  " + "─".repeat(48));
  for (const [attr, count] of usageRanked.slice(-10).reverse()) {
    console.log(`  ${attr.padEnd(40)} ${String(count).padStart(6)}`);
  }

  // ── 13. Recommendations ───────────────────────────────────────────────────────
  recommendations(games, qCounts);
}


// ── Cross-difficulty comparison ───────────────────────────────────────────────

function crossDifficultyTable(byDifficulty: Map<string, SimGameResult[]>): void {
  section("0. CROSS-DIFFICULTY COMPARISON");

  // Calibration targets from docs/guess-readiness-calibration.md
  const targets: Record<string, { label: string; target: string; dir: "gte" | "lte" }> = {
    win_pct:                 { label: "Win %",                target: "—",    dir: "gte" },
    strict_readiness_win_pct:{ label: "strict_readiness win%", target: "≥75%", dir: "gte" },
    high_certainty_win_pct:  { label: "high_certainty win%",   target: "≥90%", dir: "gte" },
    time_pressure_win_pct:   { label: "time_pressure win%",    target: "≥85%", dir: "gte" },
    forced_guess_rate:       { label: "Forced guess rate",      target: "<8%",  dir: "lte" },
    max_q_rate:              { label: "Max-questions rate",      target: "<5%",  dir: "lte" },
    avg_questions:           { label: "Avg questions",           target: "—",    dir: "lte" },
    avg_confidence:          { label: "Avg confidence",          target: "—",    dir: "gte" },
    singleton_rate:          { label: "Singleton rate",          target: "—",    dir: "gte" },
  };

  const difficulties = ["easy", "medium", "hard", "all"];
  const allGames = [...byDifficulty.values()].flat();
  const dataMap = new Map<string, SimGameResult[]>([...byDifficulty, ["all", allGames]]);

  // Build metric rows
  const rows: Record<string, Record<string, string>> = {};
  for (const [key, meta] of Object.entries(targets)) {
    rows[key] = { label: meta.label, target: meta.target };
  }

  for (const diff of difficulties) {
    const games = dataMap.get(diff);
    if (!games || games.length === 0) {
      for (const key of Object.keys(targets)) rows[key][diff] = "—";
      continue;
    }
    const total = games.length;
    const winCount = games.filter((g) => g.won).length;
    const strictWins = games.filter((g) => g.guessTrigger === "strict_readiness" && g.won).length;
    const strictTotal = games.filter((g) => g.guessTrigger === "strict_readiness").length;
    const highWins = games.filter((g) => g.guessTrigger === "high_certainty" && g.won).length;
    const highTotal = games.filter((g) => g.guessTrigger === "high_certainty").length;
    const timePressureWins = games.filter((g) => g.guessTrigger === "time_pressure" && g.won).length;
    const timePressureTotal = games.filter((g) => g.guessTrigger === "time_pressure").length;
    const forcedCount = games.filter((g) => g.forcedGuess).length;
    const maxQCount = games.filter((g) => g.guessTrigger === "max_questions").length;
    const singletonCount = games.filter((g) => g.guessTrigger === "singleton").length;
    const confVals = games.map((g) => g.confidenceAtGuess ?? 0).filter((c) => c > 0);

    rows["win_pct"][diff] = `${((winCount / total) * 100).toFixed(1)}%`;
    rows["strict_readiness_win_pct"][diff] = strictTotal > 0 ? `${((strictWins / strictTotal) * 100).toFixed(1)}%` : "—";
    rows["high_certainty_win_pct"][diff] = highTotal > 0 ? `${((highWins / highTotal) * 100).toFixed(1)}%` : "—";
    rows["time_pressure_win_pct"][diff] = timePressureTotal > 0 ? `${((timePressureWins / timePressureTotal) * 100).toFixed(1)}%` : "—";
    rows["forced_guess_rate"][diff] = `${((forcedCount / total) * 100).toFixed(1)}%`;
    rows["max_q_rate"][diff] = `${((maxQCount / total) * 100).toFixed(1)}%`;
    rows["avg_questions"][diff] = avg(games.map((g) => g.questionsAsked)).toFixed(1);
    rows["avg_confidence"][diff] = confVals.length > 0 ? `${(avg(confVals) * 100).toFixed(1)}%` : "—";
    rows["singleton_rate"][diff] = `${((singletonCount / total) * 100).toFixed(1)}%`;
  }

  const colW = 12;
  const header = `  ${"Metric".padEnd(28)} ${"Target".padEnd(8)}` +
    difficulties.map((d) => d.padStart(colW)).join("");
  console.log(header);
  console.log("  " + "─".repeat(28 + 8 + 1 + difficulties.length * colW));

  for (const [key, row] of Object.entries(rows)) {
    const meta = targets[key];
    let line = `  ${row["label"].padEnd(28)} ${row["target"].padEnd(8)}`;
    for (const diff of difficulties) {
      const val = row[diff] ?? "—";
      line += val.padStart(colW);
    }
    // Flag KPI misses with ✗
    const flags: string[] = [];
    for (const diff of ["easy", "medium", "hard", "all"]) {
      const val = row[diff] ?? "—";
      if (val === "—" || meta.target === "—") continue;
      const num = parseFloat(val);
      const tNum = parseFloat(meta.target.replace(/[^0-9.]/g, ""));
      if (meta.dir === "gte" && num < tNum) flags.push(diff);
      if (meta.dir === "lte" && num > tNum) flags.push(diff);
    }
    console.log(line + (flags.length > 0 ? `  ✗ [${flags.join(",")}]` : ""));
  }
}

// ── Category breakdown ────────────────────────────────────────────────────────

function categoryBreakdown(games: SimGameResult[]): void {
  const hasCategoryData = games.some((g) => g.targetCharacterCategory != null);
  if (!hasCategoryData) {
    console.log("\n  [Category breakdown unavailable — re-run `pnpm simulate:export` to include category data]");
    return;
  }

  section("1.6. CATEGORY BREAKDOWN");

  const byCategory = new Map<string, SimGameResult[]>();
  for (const g of games) {
    const cat = g.targetCharacterCategory ?? "unknown";
    const list = byCategory.get(cat) ?? [];
    list.push(g);
    byCategory.set(cat, list);
  }

  const rows = [...byCategory.entries()]
    .map(([cat, gs]) => {
      const wins = gs.filter((g) => g.won).length;
      const qCounts = gs.map((g) => g.questionsAsked);
      const avgQ = qCounts.reduce((a, b) => a + b, 0) / qCounts.length;
      const forcedCount = gs.filter((g) => g.forcedGuess).length;
      return { cat, total: gs.length, wins, winRate: (wins / gs.length) * 100, avgQ, forcedRate: (forcedCount / gs.length) * 100 };
    })
    .sort((a, b) => b.total - a.total);

  console.log(
    `  ${"Category".padEnd(20)} ${"Games".padStart(6)} ${"Win%".padStart(7)} ${"AvgQ".padStart(6)} ${"Forced%".padStart(8)}`
  );
  console.log("  " + "─".repeat(50));
  for (const { cat, total, winRate, avgQ, forcedRate } of rows) {
    console.log(
      `  ${cat.padEnd(20)} ${String(total).padStart(6)} ${(winRate.toFixed(1) + "%").padStart(7)} ${avgQ.toFixed(1).padStart(6)} ${(forcedRate.toFixed(1) + "%").padStart(8)}`
    );
  }
}

// ── Character difficulty clustering ──────────────────────────────────────────

function characterDifficultyClustering(games: SimGameResult[]): void {
  section("1.5. PER-CHARACTER DIFFICULTY CLUSTERING");

  const qCounts = games.map((g) => g.questionsAsked).sort((a, b) => a - b);
  const q1 = qCounts[Math.floor(qCounts.length * 0.25)];
  const q3 = qCounts[Math.floor(qCounts.length * 0.75)];

  console.log(`  Quartile thresholds: Q1=${q1}q  Q3=${q3}q  (maxQ varies by difficulty)`);
  console.log(`  Tiers: easy(≤Q1) / medium(Q1–Q3) / hard(Q3–maxQ) / exhausted(hit maxQ)`);
  console.log();

  type Tier = "easy" | "medium" | "hard" | "exhausted";
  const tierOrder: Tier[] = ["easy", "medium", "hard", "exhausted"];
  const tiers = new Map<Tier, SimGameResult[]>([
    ["easy", []],
    ["medium", []],
    ["hard", []],
    ["exhausted", []],
  ]);

  for (const g of games) {
    const tier: Tier =
      g.questionsAsked >= g.maxQuestions ? "exhausted"
      : g.questionsAsked <= q1 ? "easy"
      : g.questionsAsked <= q3 ? "medium"
      : "hard";
    tiers.get(tier)!.push(g);
  }

  console.log(
    `  ${"Tier".padEnd(12)} ${"Count".padStart(6)} ${"Win%".padStart(7)} ${"AvgQ".padStart(6)} ${"AvgAlive".padStart(9)} ${"AvgConf".padStart(8)} ${"Top trigger".padStart(18)}`
  );
  console.log("  " + "─".repeat(72));

  for (const tier of tierOrder) {
    const g = tiers.get(tier)!;
    if (g.length === 0) continue;
    const winPct = ((g.filter((x) => x.won).length / g.length) * 100).toFixed(1) + "%";
    const avgQ = avg(g.map((x) => x.questionsAsked)).toFixed(1);
    const avgAlive = avg(g.map((x) => x.aliveCountAtGuess ?? 0).filter((a) => a > 0)).toFixed(1);
    const avgConf = (avg(g.map((x) => (x.confidenceAtGuess ?? 0) * 100).filter((c) => c > 0))).toFixed(1) + "%";
    const triggerCounts = new Map<string, number>();
    for (const x of g) {
      const t = x.guessTrigger ?? "none";
      triggerCounts.set(t, (triggerCounts.get(t) ?? 0) + 1);
    }
    const topTrigger = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    console.log(
      `  ${tier.padEnd(12)} ${String(g.length).padStart(6)} ${winPct.padStart(7)} ${avgQ.padStart(6)} ${avgAlive.padStart(9)} ${avgConf.padStart(8)} ${topTrigger.padStart(18)}`
    );
  }

  // Show top 10 hardest non-exhausted characters
  const hardChars = [...tiers.get("hard")!]
    .sort((a, b) => b.questionsAsked - a.questionsAsked)
    .slice(0, 10);

  if (hardChars.length > 0) {
    subsection("Top 10 hardest characters (hard tier, not exhausted)");
    console.log(
      `  ${"Character".padEnd(40)} ${"Q#".padStart(4)} ${"Alive".padStart(6)} ${"Conf".padStart(7)} ${"Won".padStart(4)}`
    );
    console.log("  " + "─".repeat(65));
    for (const g of hardChars) {
      const conf = g.confidenceAtGuess !== null ? fmt(g.confidenceAtGuess * 100) + "%" : "—";
      const alive = g.aliveCountAtGuess !== null ? String(g.aliveCountAtGuess) : "—";
      console.log(
        `  ${g.targetCharacterName.padEnd(40)} ${String(g.questionsAsked).padStart(4)} ${alive.padStart(6)} ${conf.padStart(7)} ${(g.won ? "✓" : "✗").padStart(4)}`
      );
    }
  }
}

// ── Question selection quality by slot ───────────────────────────────────────

function questionSelectionQuality(games: SimGameResult[]): void {
  section("6.5. QUESTION SELECTION QUALITY BY SLOT");

  const slotBuckets = [
    { label: "Q1–3",   min: 1,  max: 4  },
    { label: "Q4–6",   min: 4,  max: 7  },
    { label: "Q7–9",   min: 7,  max: 10 },
    { label: "Q10–12", min: 10, max: 13 },
    { label: "Q13–15", min: 13, max: 16 },
    { label: "Q16–20", min: 16, max: 21 },
    { label: "Q21–30", min: 21, max: 31 },
    { label: "Q31+",   min: 31, max: Infinity },
  ];

  const slotData = slotBuckets.map((b) => ({ ...b, gains: [] as number[] }));

  for (const game of games) {
    game.questionsSequence.forEach((step, idx) => {
      const pos = idx + 1;
      const bucket = slotData.find((b) => pos >= b.min && pos < b.max);
      if (bucket && step.infoGain != null) {
        bucket.gains.push(step.infoGain);
      }
    });
  }

  console.log(`  Average information gain at each question slot.`);
  console.log(`  Plateau (gain not decreasing) signals repetitive or low-value question selection.`);
  console.log();
  console.log(
    `  ${"Slot".padEnd(10)} ${"Observations".padStart(13)} ${"AvgGain".padStart(9)} ${"MinGain".padStart(9)} ${"MaxGain".padStart(9)} Visual`
  );
  console.log("  " + "─".repeat(70));

  let prevAvg: number | null = null;
  const maxGainOverall = Math.max(...slotData.filter((b) => b.gains.length > 0).map((b) => avg(b.gains)));

  for (const bucket of slotData) {
    if (bucket.gains.length === 0) continue;
    const a = avg(bucket.gains);
    const mn = Math.min(...bucket.gains);
    const mx = Math.max(...bucket.gains);
    const visualLen = 20;
    const barFill = maxGainOverall > 0 ? Math.round((a / maxGainOverall) * visualLen) : 0;
    const visual = "█".repeat(barFill) + "░".repeat(visualLen - barFill);
    const plateau = prevAvg !== null && a > prevAvg * 0.85 && prevAvg < a * 1.15 ? " ⚠ plateau?" : "";
    console.log(
      `  ${bucket.label.padEnd(10)} ${String(bucket.gains.length).padStart(13)} ${fmt(a, 5).padStart(9)} ${fmt(mn, 5).padStart(9)} ${fmt(mx, 5).padStart(9)} ${visual}${plateau}`
    );
    prevAvg = a;
  }
}

// ── Recommendations (actionable) ─────────────────────────────────────────────

function recommendations(games: SimGameResult[], qCounts: number[]): void {
  section("13. RECOMMENDATIONS");

  const total = games.length;
  const wins = games.filter((g) => g.won);
  const losses = games.filter((g) => !g.won);

  const triggers = new Map<string, { count: number; wins: number }>();
  for (const g of games) {
    const t = g.guessTrigger ?? "none";
    const e = triggers.get(t) ?? { count: 0, wins: 0 };
    e.count++;
    if (g.won) e.wins++;
    triggers.set(t, e);
  }

  const strictCount = triggers.get("strict_readiness")?.count ?? 0;
  const strictWins = triggers.get("strict_readiness")?.wins ?? 0;
  const highCertCount = triggers.get("high_certainty")?.count ?? 0;
  const highCertWins = triggers.get("high_certainty")?.wins ?? 0;
  const maxQCount = triggers.get("max_questions")?.count ?? 0;
  const forcedCount = games.filter((g) => g.forcedGuess).length;

  const totalDist = { yes: 0, no: 0, maybe: 0, unknown: 0 };
  for (const g of games) {
    totalDist.yes += g.answerDistribution.yes ?? 0;
    totalDist.no += g.answerDistribution.no ?? 0;
    totalDist.maybe += g.answerDistribution.maybe ?? 0;
    totalDist.unknown += g.answerDistribution.unknown ?? 0;
  }
  const totalAnswers = totalDist.yes + totalDist.no + totalDist.maybe + totalDist.unknown;
  const unknownRate = totalAnswers > 0 ? totalDist.unknown / totalAnswers : 0;
  const lowConfWins = wins.filter((g) => (g.confidenceAtGuess ?? 1) < 0.20);
  const avgQ = avg(qCounts);

  const strictWinPct = strictCount > 0 ? (strictWins / strictCount) * 100 : null;
  const highCertWinPct = highCertCount > 0 ? (highCertWins / highCertCount) * 100 : null;
  const forcedGuessPct = (forcedCount / total) * 100;
  const maxQPct = (maxQCount / total) * 100;

  console.log(`  KPIs vs. calibration targets:`);
  console.log(`  ─────────────────────────────────────────────────────────────────────`);

  function kpiLine(label: string, value: string, target: string, ok: boolean): void {
    const status = ok ? "✓" : "✗";
    console.log(`  ${status} ${label.padEnd(34)} ${value.padEnd(10)} (target: ${target})`);
  }

  kpiLine(
    "strict_readiness win rate",
    strictWinPct !== null ? `${strictWinPct.toFixed(1)}%` : "N/A (0 games)",
    "≥75%",
    strictWinPct === null || strictWinPct >= 75
  );
  kpiLine(
    "high_certainty win rate",
    highCertWinPct !== null ? `${highCertWinPct.toFixed(1)}%` : "N/A (0 games)",
    "≥90%",
    highCertWinPct === null || highCertWinPct >= 90
  );
  kpiLine(
    "forced guess rate",
    `${forcedGuessPct.toFixed(1)}%`,
    "<8%",
    forcedGuessPct < 8
  );
  kpiLine(
    "max_questions trigger rate",
    `${maxQPct.toFixed(1)}%`,
    "<15%",
    maxQPct < 15
  );
  kpiLine(
    "low-confidence wins (<20%)",
    `${pct(lowConfWins.length, wins.length)}`,
    "<15% of wins",
    wins.length === 0 || (lowConfWins.length / wins.length) < 0.15
  );
  kpiLine(
    "unknown answer rate",
    `${pct(totalDist.unknown, totalAnswers)}`,
    "<30%",
    unknownRate < 0.30
  );

  console.log();
  console.log(`  Specific actions:`);
  console.log(`  ─────────────────────────────────────────────────────────────────────`);

  let anyAction = false;

  // time_pressure fires frequently — check win rate
  const timePressureCount = games.filter((g) => g.guessTrigger === "time_pressure").length;
  const timePressureWins = games.filter((g) => g.guessTrigger === "time_pressure" && g.won).length;
  const timePressureWinRate = timePressureCount > 0 ? timePressureWins / timePressureCount : null;

  if (timePressureCount > 0) {
    const winStr = timePressureWinRate !== null ? `${(timePressureWinRate * 100).toFixed(1)}%` : "—";
    if (timePressureWinRate !== null && timePressureWinRate < 0.80) {
      anyAction = true;
      console.log(`
  [guess-readiness.ts] time_pressure win rate is ${winStr} (target ≥80%).
    → Engine is guessing too early at endgame — competitiveCount ≤ 5 may be too loose.
    → Try tightening: competitiveCount ≤ 3 or raise questionsRemaining threshold from 3 → 2.`);
    }
  }

  // strict_readiness barely fires
  if (strictCount / total < 0.10) {
    anyAction = true;
    console.log(`
  [guess-readiness.ts] strict_readiness fires in only ${pct(strictCount, total)} of games (want ≥10%).
    → requiredEntropy formula currently starts at 1.5. Try lowering to 1.2:
        requiredEntropy = Math.max(1.2 - 0.6 * progress - priorWrongGuesses * 0.05, 0.6)
    → Alternatively, add a "dueling" fast-path: if competitiveCount ≤ 2 && gap ≥ 0.20,
      trigger before entropy check.`);
  }

  // strict_readiness win rate below target
  if (strictWinPct !== null && strictWinPct < 75) {
    anyAction = true;
    console.log(`
  [guess-readiness.ts] strict_readiness win rate is ${strictWinPct.toFixed(1)}% (target ≥75%).
    → Gate is too loose — engine guesses via strict_readiness before it's confident enough.
    → Raise requiredConfidence base: try 0.88 instead of 0.85:
        requiredConfidence = Math.min(0.88 - 0.25 * progress² + wrongGuessPenalty, 0.94)
    → Tighten requiredGap floor: try 0.10 → 0.12 minimum.`);
  }

  // high_certainty win rate below target
  if (highCertWinPct !== null && highCertWinPct < 90) {
    anyAction = true;
    console.log(`
  [guess-readiness.ts] high_certainty win rate is ${highCertWinPct.toFixed(1)}% (target ≥90%).
    → Raise topProbability threshold from 0.87 → 0.90 or require gap ≥ 0.25:
        topProbability >= 0.90 && gap >= 0.25 && competitiveCount <= 2
    → Current threshold of 0.87 may be firing on ambiguous cases.`);
  }

  // Too many forced / max_questions games
  if (maxQPct > 5) {
    anyAction = true;
    console.log(`
  [guess-readiness.ts] ${maxQPct.toFixed(1)}% of games exhaust max_questions (target <5%).
    → time_pressure trigger should catch most games before max_questions fires.
    → If max_questions is still high: competitiveCount threshold in time_pressure may be too strict
      (competitiveCount ≤ 5 blocks when too many equal candidates remain).
    → Also check: question selection may be wasting budget on low-coverage attributes.`);
  }

  if (forcedGuessPct > 8) {
    anyAction = true;
    console.log(`
  [guess-readiness.ts] Forced guess rate is ${forcedGuessPct.toFixed(1)}% (target <8%).
    → Many games end with no good guess available. Combined with high max_questions rate,
      the engine is not converging. Review question selection diversity: consecutive same-group
      questions may be wasting the question budget.`);
  }

  // Low-confidence wins (lucky guesses)
  if (wins.length > 0 && (lowConfWins.length / wins.length) > 0.15) {
    anyAction = true;
    console.log(`
  [guess-readiness.ts] ${pct(lowConfWins.length, wins.length)} of wins at <20% confidence — likely lucky forced guesses.
    → Engine is guessing before converging. To fix:
      1. Strengthen the insufficient_data hold (raise topProbability floor from 0.70 → 0.75).
      2. Confirm question selection is covering discriminating attributes early.`);
  }

  // Repetitive / low-info-gain questions
  const gainsBySlot: number[][] = Array.from({ length: 5 }, () => []);
  for (const game of games) {
    game.questionsSequence.forEach((step, idx) => {
      const slot = Math.min(idx, 4);
      if (step.infoGain != null) gainsBySlot[slot].push(step.infoGain);
    });
  }
  const earlyAvg = avg(gainsBySlot[0]);
  const midAvg = avg(gainsBySlot[2]);
  if (earlyAvg > 0 && midAvg > 0 && midAvg > earlyAvg * 0.90) {
    anyAction = true;
    console.log(`
  [question-selection.ts] Info gain is not decreasing between Q1 (${fmt(earlyAvg, 4)}) and Q3 (${fmt(midAvg, 4)}).
    → Questions may be repetitive or the diversity penalty window is too narrow.
    → Widen same-group diversity window from last 3 to last 5 questions:
        const DIVERSITY_WINDOW = 5; (currently 3)
    → Check that species/origin early-game forcing (2×/1.3×) is conditional on pool composition.`);
  }

  // High unknown rate
  if (unknownRate > 0.30) {
    anyAction = true;
    console.log(`
  [data] Unknown answer rate is ${pct(totalDist.unknown, totalAnswers)} (target <30%).
    → Significant attribute gaps remain. Run enrichment pipeline on characters
      with high question-exhaustion rates.
    → Consider raising SCORE_UNKNOWN penalty: reduce coverage cap from 0.55 → 0.45
      so sparse unknowns stop lingering in the alive set.`);
  }

  // Losses
  if (losses.length > 0) {
    anyAction = true;
    const lossRate = (losses.length / total) * 100;
    console.log(`
  [engine] ${losses.length} losses (${lossRate.toFixed(1)}%).`);
    if (losses.every((g) => g.questionsAsked >= g.maxQuestions)) {
      console.log(`    → All losses exhausted full question budget — these characters are likely
      indistinguishable in the current pool. Options:
        1. Enrich attributes for the specific characters that always lose.
        2. Adjust SCORE_MISMATCH from 0.05 → 0.03 to reduce residual probability
           of contradicted characters polluting the alive set.`);
    }
  }

  // Average question count high
  if (avgQ > 15) {
    anyAction = true;
    console.log(`
  [engine] Average ${fmt(avgQ)} questions — medium difficulty target of 15q is not being met.
    → Check BONUS_QUESTIONS_PER_REJECT: bonus questions after wrong guesses may be inflating totals.
    → Review early-guess guards: if insufficient_data is holding too conservatively, games drag on.`);
  }

  if (!anyAction) {
    console.log(`  All KPIs within targets. No immediate changes recommended.`);
    console.log(`  Consider reviewing question selection quality (section 6.5) for further refinement.`);
  }

  console.log(`\n${"═".repeat(70)}\n`);
}

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
