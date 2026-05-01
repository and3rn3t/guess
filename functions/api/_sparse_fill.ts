/**
 * Pure gap-selection helpers for DQ.22 sparse-attribute auto-fill.
 *
 * The cron picks "popular characters with the most missing attributes" so
 * each LLM call recovers maximum coverage per dollar. Pure I/O-free module
 * so the ranking and budgeting logic is unit-testable; the CLI in
 * `scripts/sparse-fill-attributes.ts` does the wrangler / OpenAI wiring.
 */

export interface CharacterCandidate {
  /** Stable character id. */
  id: string
  /** Category (anime, marvel, …) — drives which attribute keys apply. */
  category: string
  /** Popularity in [0, 1]; higher = re-asked more often. */
  popularity: number
  /** Attribute keys that already have a non-null stored value. */
  storedKeys: ReadonlySet<string>
}

export interface SelectGapsOptions {
  /** Maximum total (character, attribute) pairs the cron may fill. */
  totalGapBudget: number
  /** Per-character cap so one whale doesn't eat the whole budget. */
  maxGapsPerCharacter?: number
  /**
   * Skip characters whose popularity < this threshold. Defaults to 0
   * (consider every character).
   */
  minPopularity?: number
}

export interface CharacterGap {
  characterId: string
  category: string
  popularity: number
  /** Attribute keys to ask the LLM about, capped to `maxGapsPerCharacter`. */
  missingKeys: string[]
}

/**
 * Rank characters by popularity DESC and emit the (character, attribute) gaps
 * the cron should fill, capped by `totalGapBudget` and (optionally) by a
 * per-character ceiling. Characters with no missing keys are dropped.
 *
 * Ties on popularity break alphabetically by character id so output is stable.
 */
export function selectGaps(
  candidates: readonly CharacterCandidate[],
  attributeKeysByCategory: ReadonlyMap<string, readonly string[]>,
  opts: SelectGapsOptions
): CharacterGap[] {
  const { totalGapBudget, maxGapsPerCharacter, minPopularity = 0 } = opts
  if (totalGapBudget <= 0) return []

  const ranked = [...candidates]
    .filter((c) => c.popularity >= minPopularity)
    .sort((a, b) => {
      if (b.popularity !== a.popularity) return b.popularity - a.popularity
      return a.id.localeCompare(b.id)
    })

  const result: CharacterGap[] = []
  let used = 0
  for (const c of ranked) {
    if (used >= totalGapBudget) break
    const allKeys = attributeKeysByCategory.get(c.category)
    if (!allKeys || allKeys.length === 0) continue
    const missing = allKeys.filter((k) => !c.storedKeys.has(k))
    if (missing.length === 0) continue
    const remainingBudget = totalGapBudget - used
    const cap = maxGapsPerCharacter ?? remainingBudget
    const take = Math.min(missing.length, cap, remainingBudget)
    if (take <= 0) continue
    result.push({
      characterId: c.id,
      category: c.category,
      popularity: c.popularity,
      missingKeys: missing.slice(0, take),
    })
    used += take
  }
  return result
}

/**
 * Group a flat list of character gaps into per-category batches so each LLM
 * call carries exactly one `attributeKeys` payload (the union of every
 * character's missing keys for that category). Stable ordering: gaps within
 * a batch keep `selectGaps` ordering.
 */
export function groupGapsByCategory(
  gaps: readonly CharacterGap[]
): Map<string, CharacterGap[]> {
  const out = new Map<string, CharacterGap[]>()
  for (const g of gaps) {
    const list = out.get(g.category)
    if (list) list.push(g)
    else out.set(g.category, [g])
  }
  return out
}

/**
 * Union of every gap's missingKeys for a single category — what the prompt
 * builder needs as its `attrKeys` argument so the LLM answers every missing
 * field across the batch in one shot.
 */
export function unionMissingKeys(gaps: readonly CharacterGap[]): string[] {
  const set = new Set<string>()
  for (const g of gaps) for (const k of g.missingKeys) set.add(k)
  return [...set].sort()
}
