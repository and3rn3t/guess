/**
 * GET  /api/admin/data-quality-sla — DQ.32 SLA targets for admin rendering.
 *
 * Returns the per-attribute, per-category completeness targets from the
 * canonical SLA matrix. Used by the admin dashboard to render target overlays
 * on coverage metrics.
 *
 * Protected by the Basic-auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse } from '../_helpers'
import { DQ_CATEGORIES, DQ33_RULES } from './data-quality/_sla_matrix'

interface SlaTarget {
  attributeKey: string
  displayName: string
  category: string
  target: number
}

interface SlaResponse {
  targets: SlaTarget[]
}

/**
 * Convert camelCase to human-readable format.
 * Example: "firstAppearedYear" → "First Appeared Year"
 */
function displayNameFromKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1') // Insert space before capitals
    .replace(/^./, (c) => c.toUpperCase()) // Capitalize first letter
    .trim()
}

export const onRequestGet: PagesFunction<Env> = async (_context) => {
  // Flatten the SLA rules into a per-category, per-attribute target list
  const targets: SlaTarget[] = []

  for (const rule of DQ33_RULES) {
    const displayName = displayNameFromKey(rule.attributeKey)

    for (const category of DQ_CATEGORIES) {
      const target = rule.targets[category]
      if (target !== undefined) {
        targets.push({
          attributeKey: rule.attributeKey,
          displayName,
          category,
          target,
        })
      }
    }
  }

  return jsonResponse({
    targets,
  } as SlaResponse)
}
