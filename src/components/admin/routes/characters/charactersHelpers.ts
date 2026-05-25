/**
 * Pure helpers extracted from CharactersRoute.
 * Co-located with the route under `routes/characters/` so the
 * orchestration shell can stay thin.
 */

export type AttributeApiValue = 0 | 1 | null

export type SortKey =
  | 'popularity'
  | 'name'
  | 'coverage'
  | 'createdAt'
  | 'needsWork'
  | 'recentlyAdded'

export function toNullableBoolean(value: AttributeApiValue): boolean | null {
  if (value === 1) return true
  if (value === 0) return false
  return null
}

export function issueCountMessage(issueCount: number): string {
  if (issueCount === 0) return 'No issues found'
  const suffix = issueCount === 1 ? '' : 's'
  return `${issueCount} issue${suffix} found`
}

/**
 * Cycles an attribute value: null → true (1) → false (0) → null.
 * Used by the expand panel's per-attribute toggle buttons.
 */
export function nextAttrValue(v: AttributeApiValue): AttributeApiValue {
  if (v === null) return 1
  if (v === 1) return 0
  return null
}
