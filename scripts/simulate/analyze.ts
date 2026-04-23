#!/usr/bin/env -S npx tsx
/**
 * Simulation analytics — reads a JSONL file of SimGameResult records
 * and prints a detailed diagnostic report.
 *
 * Usage:
 *   pnpm simulate --sample 300 --output scripts/simulate/data/results.jsonl
 *   npx tsx scripts/simulate/analyze.ts scripts/simulate/data/results.jsonl
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

  const attrInfoGain = new Map<string, { total: number; count: number }>();
  for (const game of games) {
    for (const step of game.questionsSequence) {
      const e = attrInfoGain.get(step.attribute) ?? { total: 0, count: 0 };
      e.total += step.infoGain;
      e.count++;
      attrInfoGain.set(step.attribute, e);
    }
  }

  const attrRanked = [...attrInfoGain.entries()]
    .map(([attr, { total, count }]) => ({ attr, avgGain: total / count, count }))
    .sort((a, b) => b.avgGain - a.avgGain);

  subsection("Top 25 Most Discriminating Attributes");
  console.log(
    `  ${"Attribute".padEnd(40)} ${"AvgGain".padStart(8)} ${"Asked".padStart(6)}`
  );
  console.log("  " + "─".repeat(57));
  for (const { attr, avgGain, count } of attrRanked.slice(0, 25)) {
    console.log(
      `  ${attr.padEnd(40)} ${fmt(avgGain, 4).padStart(8)} ${String(count).padStart(6)}`
    );
  }

  subsection("Bottom 25 Least Discriminating Attributes (asked ≥5 times)");
  console.log(
    `  ${"Attribute".padEnd(40)} ${"AvgGain".padStart(8)} ${"Asked".padStart(6)}`
  );
  console.log("  " + "─".repeat(57));
  const bottom = attrRanked.filter((a) => a.count >= 5).slice(-25).reverse();
  for (const { attr, avgGain, count } of bottom) {
    console.log(
      `  ${attr.padEnd(40)} ${fmt(avgGain, 4).padStart(8)} ${String(count).padStart(6)}`
    );
  }

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
  section("13. RECOMMENDATIONS");

  // Compute key metrics for recommendations
  const avgQ = avg(qCounts);
  void avgQ;
  const strictCount = triggers.get("strict_readiness")?.count ?? 0;
  const highCertCount = triggers.get("high_certainty")?.count ?? 0;
  const maxQCount = triggers.get("max_questions")?.count ?? 0;
  const lowConfCount = lowConfWins.length;
  const unknownRate = totalDist.unknown / Math.max(totalAnswers, 1);

  console.log(`  Key metrics:`);
  console.log(`    strict_readiness trigger : ${strictCount}/${total} (${pct(strictCount, total)})`);
  console.log(`    high_certainty trigger   : ${highCertCount}/${total} (${pct(highCertCount, total)})`);
  console.log(`    max_questions trigger    : ${maxQCount}/${total} (${pct(maxQCount, total)})`);
  console.log(`    low-conf wins (<20%)     : ${lowConfCount}/${wins.length} (${pct(lowConfCount, wins.length)})`);
  console.log(`    unknown answer rate      : ${pct(totalDist.unknown, totalAnswers)}`);
  console.log();

  if (strictCount / total < 0.1) {
    console.log(`  ⚠  strict_readiness barely fires (${pct(strictCount, total)}). Consider:`);
    console.log(`       - Lowering requiredEntropy floor (currently max(0.55 - 0.2*progress, 0.3))`);
    console.log(`       - Adding a "dueling" trigger: if competitiveCount ≤ 2 && gap ≥ 0.20`);
  }

  if (maxQCount / total > 0.80) {
    console.log(`  ⚠  ${pct(maxQCount, total)} of games hit max_questions before guessing.`);
    console.log(`       - Engine is conservative; consider relaxing early-guess guards.`);
  }

  if (lowConfCount / wins.length > 0.15) {
    console.log(`  ⚠  ${pct(lowConfCount, wins.length)} of wins at <20% confidence.`);
    console.log(`       - Many wins are lucky forced guesses after question exhaustion.`);
    console.log(`       - Better question coverage for obscure characters would help.`);
  }

  if (unknownRate > 0.30) {
    console.log(`  ⚠  ${pct(totalDist.unknown, totalAnswers)} unknown answers.`);
    console.log(`       - Data coverage gaps remain significant; enrichment needed.`);
  }

  if (losses.length > 0) {
    const lossRate = losses.length / total;
    console.log(`  ⚠  ${losses.length} losses (${fmt(lossRate * 100)}%).`);
    if (losses.every((g) => g.questionsAsked >= 200)) {
      console.log(`       - All losses exhausted full question bank.`);
      console.log(`       - These characters are likely indistinguishable from the pool.`);
      console.log(`       - Consider: attribute enrichment, or allowing "I give up" for very obscure chars.`);
    }
  }

  if (avgQ > 40) {
    console.log(`  ⚠  Average ${fmt(avgQ)} questions per game is high.`);
    console.log(`       - Medium difficulty (15q target) is not being achieved.`);
    console.log(`       - Review BONUS_QUESTIONS_PER_REJECT and early-guess thresholds.`);
  }

  console.log(`\n${"═".repeat(70)}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/simulate/analyze.ts <results.jsonl>");
  process.exit(1);
}

const resolved = path.resolve(filePath);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

console.log(`\nLoading results from: ${resolved}`);
const results = await loadResults(resolved);
console.log(`Loaded ${results.length} game records.`);

if (results.length === 0) {
  console.error("No valid records found.");
  process.exit(1);
}

analyzeResults(results);
