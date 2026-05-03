/**
 * DQ.33 — deterministic null-closure queue scoring.
 *
 * Produces a stable daily queue of missing (character, attribute) pairs using
 * the best local proxies already present in the repo:
 *   popularity      -> recent player demand for the character
 *   selectorImpact  -> recent question traffic and information gain for the attribute
 *   confidenceGap   -> SLA target shortfall for (attribute, category)
 *   staleness       -> age of the character row, oldest first when all else ties
 *
 * The queue also emits a routing lane so automation can consume the high-
 * confidence slice while ambiguous work can surface in manual review.
 */

export interface NullClosurePairInput {
  characterId: string
  characterName: string
  category: string
  attributeKey: string
  popularity: number
  selectorImpact: number
  confidenceGap: number
  stalenessDays: number
  hasQuestion: boolean
}

export interface NullClosureQueueItem {
  characterId: string
  characterName: string
  category: string
  attributeKey: string
  score: number
  lane: 'automation' | 'manual'
  components: {
    popularity: number
    selectorImpact: number
    confidenceGap: number
    staleness: number
  }
}

export interface BuildNullClosureQueueOptions {
  limit?: number
  automationScoreThreshold?: number
  automationMinConfidenceGap?: number
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function normalizeStaleness(days: number): number {
  if (!Number.isFinite(days) || Number.isNaN(days) || days <= 0) return 0
  return clamp01(days / 90)
}

export function buildNullClosureQueue(
  pairs: readonly NullClosurePairInput[],
  opts: BuildNullClosureQueueOptions = {}
): NullClosureQueueItem[] {
  const limit = Math.max(1, Math.trunc(opts.limit ?? 100))
  const automationScoreThreshold = Math.max(0, opts.automationScoreThreshold ?? 0.00002)
  const automationMinConfidenceGap = clamp01(opts.automationMinConfidenceGap ?? 0.1)

  const scored = pairs.map((pair) => {
    const popularity = clamp01(pair.popularity)
    const selectorImpact = clamp01(pair.selectorImpact)
    const confidenceGap = clamp01(pair.confidenceGap)
    const staleness = normalizeStaleness(pair.stalenessDays)

    const score = Math.round(popularity * selectorImpact * confidenceGap * staleness * 1000000) / 1000000
    const lane =
      pair.hasQuestion &&
      confidenceGap >= automationMinConfidenceGap &&
      score >= automationScoreThreshold
        ? 'automation'
        : 'manual'

    return {
      characterId: pair.characterId,
      characterName: pair.characterName,
      category: pair.category,
      attributeKey: pair.attributeKey,
      score,
      lane,
      components: {
        popularity,
        selectorImpact,
        confidenceGap,
        staleness,
      },
    } satisfies NullClosureQueueItem
  })

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.components.confidenceGap !== a.components.confidenceGap) {
        return b.components.confidenceGap - a.components.confidenceGap
      }
      if (b.components.popularity !== a.components.popularity) {
        return b.components.popularity - a.components.popularity
      }
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      if (a.characterName !== b.characterName) return a.characterName.localeCompare(b.characterName)
      return a.attributeKey.localeCompare(b.attributeKey)
    })
    .slice(0, limit)
}