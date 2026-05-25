import {
  avg,
  bar,
  fmt,
  median,
  p90,
  pct,
  section,
  subsection,
  type SimGameResult,
} from "./_shared";
import {
  categoryBreakdown,
  characterDifficultyClustering,
  questionSelectionQuality,
} from "./breakdowns";
import { recommendations } from "./recommendations";

export function analyzeResults(games: SimGameResult[]): void {
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
