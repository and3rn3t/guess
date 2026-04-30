#!/usr/bin/env npx tsx
/**
 * Self-tune scoring weights from recent real games.
 *
 * Strategy (deliberately conservative):
 *   1. Read the current active weights from kv:engine:weights-active (or fall
 *      back to compiled defaults).
 *   2. Pull the last N days of `game_stats` for the control arm only (we tune
 *      against the production baseline, never against an experiment arm).
 *   3. For each candidate weight set in a small ±10% grid, replay the
 *      Bayesian likelihood that the true character would have been ranked
 *      #1 at the moment of the final guess. Higher = better.
 *   4. Write the winning candidate to data/self-tune/weights-candidate.json
 *      AND emit a summary JSON the workflow can post.
 *
 * The workflow is responsible for then writing the candidate to
 * `kv:ab:experiment-weights` (NOT `kv:engine:weights-active`) and bumping
 * the experiment percentage to 10% so the candidate is A/B-tested before
 * any promotion.
 *
 * Hard guardrails:
 *   - Each weight constrained to ±10% of the previous active value.
 *   - At least 200 control games required, else exit 0 with no-op.
 *   - Replay uses the saved `steps` JSON from game_stats; games without
 *     steps are skipped.
 *
 * Usage:
 *   npx tsx scripts/self-tune-weights.ts [--env preview|production] [--days N]
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ENV_FLAG = (() => {
  const i = process.argv.indexOf("--env");
  return i >= 0 ? process.argv[i + 1] : "production";
})();
const DAYS = (() => {
  const i = process.argv.indexOf("--days");
  return i >= 0 ? Number.parseInt(process.argv[i + 1] ?? "7", 10) : 7;
})();
const DB_NAME = ENV_FLAG === "production" ? "guess-db" : "guess-db-preview";

const OUT_DIR = path.join("data", "self-tune");
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIN_GAMES = 200;

// Compiled defaults — must match packages/game-engine/src/constants.ts
const DEFAULTS = {
  match: 1.0,
  mismatch: 0.03,
  maybe: 0.7,
  maybeMiss: 0.3,
} as const;
type Weights = {
  match: number;
  mismatch: number;
  maybe: number;
  maybeMiss: number;
};

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

function kvGet(key: string): string | null {
  try {
    const out = execFileSync(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "get",
        "--binding",
        "GUESS_KV",
        "--env",
        ENV_FLAG,
        "--remote",
        key,
      ],
      { encoding: "utf8" },
    );
    return out.trim() || null;
  } catch {
    return null;
  }
}

function loadActiveWeights(): Weights {
  const raw = kvGet("engine:weights-active");
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<Weights>;
    return {
      match: typeof parsed.match === "number" ? parsed.match : DEFAULTS.match,
      mismatch:
        typeof parsed.mismatch === "number"
          ? parsed.mismatch
          : DEFAULTS.mismatch,
      maybe: typeof parsed.maybe === "number" ? parsed.maybe : DEFAULTS.maybe,
      maybeMiss:
        typeof parsed.maybeMiss === "number"
          ? parsed.maybeMiss
          : DEFAULTS.maybeMiss,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

interface Step {
  attribute?: string;
  answer?: "yes" | "no" | "maybe" | "unknown";
}

interface GameRow {
  id: number;
  character_id: string;
  steps: string | null;
}

/**
 * Replay one game and return the log-likelihood that the true character is
 * ranked #1 after all answered steps. Higher = better tuning.
 *
 * Simplified Bayesian replay: for each (attribute, answer) pair, multiply each
 * candidate's score by the appropriate weight if its stored value matches.
 * We don't have access to the full character pool here, so we approximate
 * this as "did the answer support the true character?" — a positive score
 * means the weights penalise contradictions and reward matches well.
 */
function scoreGame(
  row: GameRow,
  w: Weights,
  charactersAttrs: Map<string, Record<string, boolean | null>>,
): number {
  if (!row.steps) return 0;
  let steps: Step[];
  try {
    steps = JSON.parse(row.steps) as Step[];
  } catch {
    return 0;
  }
  const trueAttrs = charactersAttrs.get(row.character_id);
  if (!trueAttrs) return 0;

  let logScore = 0;
  for (const s of steps) {
    if (!s.attribute || !s.answer) continue;
    const trueVal = trueAttrs[s.attribute];
    if (trueVal === undefined) continue;

    let mult: number;
    if (s.answer === "yes") {
      mult = trueVal === true ? w.match : w.mismatch;
    } else if (s.answer === "no") {
      mult = trueVal === false ? w.match : w.mismatch;
    } else if (s.answer === "maybe") {
      mult = trueVal !== null ? w.maybe : w.maybeMiss;
    } else {
      continue;
    }
    logScore += Math.log(Math.max(mult, 1e-6));
  }
  return logScore;
}

function clip(value: number, base: number, pct = 0.1, lo = 0, hi = 5): number {
  const min = Math.max(lo, base * (1 - pct));
  const max = Math.min(hi, base * (1 + pct));
  return Math.min(max, Math.max(min, value));
}

function gridSearch(
  games: GameRow[],
  baseline: Weights,
  charAttrs: Map<string, Record<string, boolean | null>>,
) {
  // Small grid: ±10%, ±5%, 0% on each weight. 3^4 = 81 candidates.
  const factors = [-0.1, -0.05, 0, 0.05, 0.1];
  let best = { weights: { ...baseline }, score: -Infinity };
  for (const fM of factors)
    for (const fMm of factors)
      for (const fMa of factors)
        for (const fMms of factors) {
          const cand: Weights = {
            match: clip(baseline.match * (1 + fM), baseline.match),
            mismatch: clip(baseline.mismatch * (1 + fMm), baseline.mismatch),
            maybe: clip(baseline.maybe * (1 + fMa), baseline.maybe),
            maybeMiss: clip(
              baseline.maybeMiss * (1 + fMms),
              baseline.maybeMiss,
            ),
          };
          let total = 0;
          for (const g of games) total += scoreGame(g, cand, charAttrs);
          if (total > best.score) best = { weights: cand, score: total };
        }
  return best;
}

async function main(): Promise<void> {
  console.log(`[self-tune] env=${ENV_FLAG} days=${DAYS}`);
  const baseline = loadActiveWeights();
  console.log(`[self-tune] baseline weights:`, baseline);

  const cutoff = Date.now() - DAYS * 86400 * 1000;

  // Pull last N days of WON control games (we tune toward what worked).
  const games = d1<GameRow>(
    `SELECT id, character_id, steps FROM game_stats
     WHERE created_at > ${cutoff}
       AND won = 1
       AND (variant IS NULL OR variant = 'control')
       AND steps IS NOT NULL
     LIMIT 5000`,
  );
  console.log(`[self-tune] loaded ${games.length} won control games`);

  if (games.length < MIN_GAMES) {
    const summary = {
      env: ENV_FLAG,
      days: DAYS,
      games: games.length,
      minGames: MIN_GAMES,
      action: "skip",
      reason: "insufficient_data",
    };
    fs.writeFileSync(
      path.join(OUT_DIR, "summary.json"),
      JSON.stringify(summary, null, 2),
    );
    console.log("[self-tune] insufficient data, skipping");
    return;
  }

  // Pull the character attributes blob once — we need true values to score replays.
  // Stored as 0/1 ints in attributes_json; convert to boolean for replay.
  const attrRows = d1<{ id: string; attributes_json: string }>(
    `SELECT id, attributes_json FROM characters WHERE attributes_json != '{}'`,
  );
  const charAttrs = new Map<string, Record<string, boolean | null>>();
  for (const r of attrRows) {
    try {
      const raw = JSON.parse(r.attributes_json) as Record<string, number>;
      const converted: Record<string, boolean | null> = {};
      for (const [k, v] of Object.entries(raw)) converted[k] = v === 1;
      charAttrs.set(r.id, converted);
    } catch {
      // skip malformed
    }
  }
  console.log(`[self-tune] loaded ${charAttrs.size} character attribute blobs`);

  const baselineScore = games.reduce(
    (sum, g) => sum + scoreGame(g, baseline, charAttrs),
    0,
  );
  const best = gridSearch(games, baseline, charAttrs);
  const improvement = best.score - baselineScore;
  const improvementPct =
    baselineScore !== 0 ? (improvement / Math.abs(baselineScore)) * 100 : 0;

  console.log(
    `[self-tune] baseline log-likelihood: ${baselineScore.toFixed(2)}`,
  );
  console.log(
    `[self-tune] best     log-likelihood: ${best.score.toFixed(2)} (${improvementPct.toFixed(2)}% gain)`,
  );
  console.log(`[self-tune] candidate weights:`, best.weights);

  const summary = {
    env: ENV_FLAG,
    days: DAYS,
    games: games.length,
    baseline,
    candidate: best.weights,
    baselineScore,
    candidateScore: best.score,
    improvementPct,
    action: improvementPct > 0.5 ? "propose" : "skip",
    reason:
      improvementPct > 0.5 ? "gain_above_threshold" : "gain_below_threshold",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "weights-candidate.json"),
    JSON.stringify(best.weights, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(`[self-tune] action=${summary.action}`);
}

void main().catch((err) => {
  console.error("[self-tune] fatal:", err);
  process.exit(1);
});
