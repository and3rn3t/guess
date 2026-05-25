import { avg, fmt, pct, section, type SimGameResult } from "./_shared";

// ── Recommendations (actionable) ─────────────────────────────────────────────

export function recommendations(games: SimGameResult[], qCounts: number[]): void {
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
