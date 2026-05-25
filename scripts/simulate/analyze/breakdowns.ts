import {
  avg,
  fmt,
  section,
  subsection,
  type SimGameResult,
} from "./_shared";

// ── Cross-difficulty comparison ───────────────────────────────────────────────

export function crossDifficultyTable(byDifficulty: Map<string, SimGameResult[]>): void {
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

export function categoryBreakdown(games: SimGameResult[]): void {
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

export function characterDifficultyClustering(games: SimGameResult[]): void {
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

export function questionSelectionQuality(games: SimGameResult[]): void {
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
