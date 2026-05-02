/**
 * AN.11 — "Aha moment" helper (pure, no I/O).
 *
 * Detects which question in a game produced the largest jump in the engine's
 * top-candidate posterior probability.  The result drives:
 *  - `game_stats.aha_attr` / `game_stats.aha_jump` (stored at result time)
 *  - Aggregate `kv:aha-moments` blob (built by the nightly aggregator)
 *  - Per-game highlight in the player-facing reasoning panel
 */

/** One entry from `game_stats` used by the aggregator. */
export interface AhaRow {
  aha_attr: string | null
  aha_jump: number | null
}

/** Aggregate summary for a single attribute. */
export interface AhaMomentSummary {
  attribute: string
  count: number
  /** Median posterior jump across all games where this attribute was the aha. */
  medianJump: number
  /** Average posterior jump. */
  avgJump: number
}

/**
 * Given the per-step top-candidate posterior probability after each answer,
 * return the answer index (0-based) and magnitude of the largest jump.
 *
 * Returns `null` when there are fewer than 3 steps (not enough signal).
 *
 * @param posteriorHistory  top-candidate probability [0,1] after each answer.
 *                          Index 0 = after first answer.
 */
export function computeAhaMoment(
  posteriorHistory: number[]
): { index: number; jump: number } | null {
  if (posteriorHistory.length < 3) return null

  let bestIdx = -1
  let bestJump = -Infinity

  for (let i = 1; i < posteriorHistory.length; i++) {
    const jump = posteriorHistory[i] - posteriorHistory[i - 1]
    if (jump > bestJump) {
      bestJump = jump
      bestIdx = i
    }
  }

  if (bestIdx < 0 || bestJump <= 0) return null
  return { index: bestIdx, jump: Number(bestJump.toFixed(4)) }
}

/**
 * Median of an array of numbers.  Returns 0 for empty arrays.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4))
    : Number(sorted[mid].toFixed(4))
}

/**
 * Build an aggregate map from a list of `game_stats`-style rows.
 * Each row with a non-null `aha_attr` contributes one data point.
 *
 * Returns an array of {@link AhaMomentSummary} sorted by count desc.
 */
export function buildAhaMomentsMap(rows: AhaRow[]): AhaMomentSummary[] {
  const grouped: Record<string, number[]> = {}

  for (const row of rows) {
    if (!row.aha_attr || row.aha_jump == null) continue
    const attr = row.aha_attr
    if (!grouped[attr]) grouped[attr] = []
    grouped[attr].push(row.aha_jump)
  }

  const summaries: AhaMomentSummary[] = Object.entries(grouped).map(([attribute, jumps]) => ({
    attribute,
    count: jumps.length,
    medianJump: median(jumps),
    avgJump: Number((jumps.reduce((s, j) => s + j, 0) / jumps.length).toFixed(4)),
  }))

  return summaries.sort((a, b) => b.count - a.count)
}
