/**
 * DQ.38 — completeness burndown pure helpers.
 *
 * computeSlaMisses  — identify attributes below their SLA target per category
 * computeQueueAging — age distribution of null-backlog characters
 */

export interface SlaRule {
  attributeKey: string
  targets: Record<string, number>
}

export interface SlaMiss {
  attributeKey: string
  category: string
  target: number
  actual: number
  gap: number
}

/**
 * Compare actual per-(attribute, category) fill rates against SLA targets.
 * `actual` values should be fractions [0, 1].
 * Returns misses sorted by descending gap (largest shortfall first).
 */
export function computeSlaMisses(
  rules: readonly SlaRule[],
  actualByAttrCategory: ReadonlyMap<string, ReadonlyMap<string, number>>,
): SlaMiss[] {
  const misses: SlaMiss[] = []
  for (const rule of rules) {
    const byCategory = actualByAttrCategory.get(rule.attributeKey) ?? new Map<string, number>()
    for (const [category, target] of Object.entries(rule.targets)) {
      const actual = byCategory.get(category) ?? 0
      if (actual < target) {
        misses.push({
          attributeKey: rule.attributeKey,
          category,
          target,
          actual: Math.round(actual * 10000) / 10000,
          gap: Math.round((target - actual) * 10000) / 10000,
        })
      }
    }
  }
  return misses.sort((a, b) => b.gap - a.gap)
}

export interface QueueAgingStats {
  totalItems: number
  medianAgeDays: number
  p90AgeDays: number
  oldestItemDays: number
}

/**
 * Compute null-closure queue age distribution.
 * `createdAtSec` is the character creation timestamp (Unix seconds) used as
 * the best available proxy for how long a null pair has been outstanding.
 */
export function computeQueueAging(items: readonly { createdAtSec: number }[]): QueueAgingStats {
  if (items.length === 0) {
    return { totalItems: 0, medianAgeDays: 0, p90AgeDays: 0, oldestItemDays: 0 }
  }
  const nowSec = Date.now() / 1000
  const ages = items
    .map((item) => Math.max(0, (nowSec - item.createdAtSec) / 86400))
    .sort((a, b) => a - b)
  const mid = Math.floor(ages.length / 2)
  const median =
    ages.length % 2 === 0 ? ((ages[mid - 1] ?? 0) + (ages[mid] ?? 0)) / 2 : (ages[mid] ?? 0)
  const p90Idx = Math.min(Math.floor(ages.length * 0.9), ages.length - 1)
  return {
    totalItems: ages.length,
    medianAgeDays: Math.round(median * 10) / 10,
    p90AgeDays: Math.round((ages[p90Idx] ?? 0) * 10) / 10,
    oldestItemDays: Math.round((ages[ages.length - 1] ?? 0) * 10) / 10,
  }
}
