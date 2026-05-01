/**
 * AN.7 — pure shape + helper for the confusion-matrix endpoint.
 *
 * The endpoint serves two sources:
 *
 *  - `real` (default): rows from `character_confusions`, populated nightly by
 *    `scripts/aggregate-real-game-signals.ts` from `game_stats` losses joined
 *    to `game_reveals.actual_character_id`. Stored canonically with
 *    `character_a < character_b`, so pairs are *undirected* — `winPct` is null.
 *
 *  - `sim`: rows from `sim_game_stats` (target / second-best). Pairs are
 *    *directed* and carry a meaningful `winPct`.
 *
 * This module owns:
 *  - `ConfusionSource` union + `ConfusionPair` response shape.
 *  - `parseConfusionParams()` — query-string \u2192 normalised inputs.
 *  - `formatRealPair` / `formatSimPair` — DB row \u2192 unified pair shape.
 *
 * SQL stays in `confusion.ts` so the parameterised statements live next to the
 * handler that owns them; this module is intentionally DB-agnostic so it can
 * be unit-tested without `better-sqlite3`.
 */

export type ConfusionSource = 'real' | 'sim'

export interface ConfusionPair {
  /** Lower-id half of the pair for `real`; the targeted character for `sim`. */
  targetId: string
  targetName: string
  /** Higher-id half for `real`; the second-best for `sim`. */
  confusedWithId: string
  confusedWithName: string
  confusionCount: number
  /** Directional win % for `sim`; null for `real` (pairs are undirected). */
  winPct: number | null
  /** Unix-ms timestamp of the most recent confusion event. Null for `sim`. */
  lastSeen: number | null
}

/** Raw row shape returned by the `real` query (joined to `characters`). */
export interface RealConfusionRow {
  character_a: string
  character_b: string
  name_a: string | null
  name_b: string | null
  confusion_count: number
  last_seen: number
}

/** Raw row shape returned by the `sim` query. */
export interface SimConfusionRow {
  targetId: string
  targetName: string
  confusedWithId: string
  confusedWithName: string
  confusionCount: number
  winPct: number
}

export interface ConfusionParams {
  source: ConfusionSource
  limit: number
  minConfusions: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const MIN_LIMIT = 5
const DEFAULT_MIN_CONFUSIONS = 2
const DEFAULT_SOURCE: ConfusionSource = 'real'

function clampLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? `${DEFAULT_LIMIT}`, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed))
}

function clampMinConfusions(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? `${DEFAULT_MIN_CONFUSIONS}`, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_CONFUSIONS
  return Math.max(1, parsed)
}

function parseSource(raw: string | null): ConfusionSource {
  if (raw === 'sim') return 'sim'
  if (raw === 'real') return 'real'
  return DEFAULT_SOURCE
}

/**
 * Parse the URL search params used by `/api/admin/confusion`.
 * Defaults: source=real, limit=50, minConfusions=2.
 */
export function parseConfusionParams(search: URLSearchParams): ConfusionParams {
  return {
    source: parseSource(search.get('source')),
    limit: clampLimit(search.get('limit')),
    minConfusions: clampMinConfusions(search.get('minConfusions')),
  }
}

/**
 * Project a `character_confusions`-row + joined character names into the
 * unified pair shape. Falls back to the id when the join misses (a referenced
 * character was deleted but the confusion row hasn't been pruned yet).
 */
export function formatRealPair(row: RealConfusionRow): ConfusionPair {
  return {
    targetId: row.character_a,
    targetName: row.name_a ?? row.character_a,
    confusedWithId: row.character_b,
    confusedWithName: row.name_b ?? row.character_b,
    confusionCount: row.confusion_count,
    winPct: null,
    lastSeen: row.last_seen,
  }
}

/** Project a `sim_game_stats`-derived row into the unified pair shape. */
export function formatSimPair(row: SimConfusionRow): ConfusionPair {
  return {
    targetId: row.targetId,
    targetName: row.targetName,
    confusedWithId: row.confusedWithId,
    confusedWithName: row.confusedWithName,
    confusionCount: row.confusionCount,
    winPct: row.winPct,
    lastSeen: null,
  }
}
