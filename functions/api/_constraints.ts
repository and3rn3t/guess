/**
 * Logical-constraint validator (DQ.4).
 *
 * Pure functions that check an attribute map against a constraint set and
 * return zero or more violations. Constraints are loaded from
 * `data/attribute-constraints.json` (mirrors the DSL sketched in ROADMAP
 * DQ.4 — JSON instead of YAML so we don't add a runtime parser dep).
 *
 * The enrichment pipeline calls `validateAttributes()` after each LLM batch;
 * each violation becomes an `attribute_disputes` row so the skeptic LLM /
 * admin queue can resolve it.
 */

export type AttributeValue = boolean | null

export type AttributeMap = Record<string, AttributeValue>

interface KeyValuePredicate {
  key: string
  value: boolean
}

export interface MutexConstraint {
  id: string
  type: 'mutex'
  keys: string[]
  reason: string
}

export interface RequiresOneOfConstraint {
  id: string
  type: 'requiresOneOf'
  keys: string[]
  reason: string
}

export interface ImpliesConstraint {
  id: string
  type: 'implies'
  if: KeyValuePredicate
  then:
    | { allOf: KeyValuePredicate[] }
    | { anyOf: KeyValuePredicate[] }
  reason: string
}

export type Constraint = MutexConstraint | RequiresOneOfConstraint | ImpliesConstraint

export interface ConstraintSet {
  version: number
  description?: string
  constraints: Constraint[]
}

export interface Violation {
  constraintId: string
  reason: string
  /**
   * Attribute key that should be flagged as disputed. For mutex/implies the
   * "primary" key is the antecedent (e.g. the conflicting `isHero` in a
   * mutex), so callers can file a single attribute_disputes row.
   */
  attributeKey: string
  /** Stored boolean value for `attributeKey`, useful for the dispute row. */
  currentValue: boolean | null
}

export function validateAttributes(
  attrs: AttributeMap,
  set: ConstraintSet
): Violation[] {
  const violations: Violation[] = []

  for (const constraint of set.constraints) {
    if (constraint.type === 'mutex') {
      const trueKeys = constraint.keys.filter((k) => attrs[k] === true)
      if (trueKeys.length > 1) {
        // Flag every attribute that participates in the conflict so the
        // skeptic queue surfaces all sides; cheaper than picking a winner.
        for (const key of trueKeys) {
          violations.push({
            constraintId: constraint.id,
            reason: constraint.reason,
            attributeKey: key,
            currentValue: true,
          })
        }
      }
      continue
    }

    if (constraint.type === 'requiresOneOf') {
      // Only enforce when every relevant key has a non-null value — a sparse
      // map shouldn't produce noise during partial enrichments.
      const decided = constraint.keys.every((k) => attrs[k] !== undefined && attrs[k] !== null)
      if (!decided) continue
      const someTrue = constraint.keys.some((k) => attrs[k] === true)
      if (!someTrue) {
        violations.push({
          constraintId: constraint.id,
          reason: constraint.reason,
          attributeKey: constraint.keys[0],
          currentValue: attrs[constraint.keys[0]] ?? null,
        })
      }
      continue
    }

    // implies
    const ifValue = attrs[constraint.if.key]
    if (ifValue === undefined || ifValue === null) continue
    const ifSatisfied = ifValue === constraint.if.value
    if (!ifSatisfied) continue

    const then = constraint.then
    let consequentHolds: boolean
    if ('allOf' in then) {
      // Every allOf clause whose key has a value must match.
      consequentHolds = then.allOf.every((p) => {
        const v = attrs[p.key]
        return v === undefined || v === null ? true : v === p.value
      })
    } else {
      // anyOf: at least one clause must explicitly hold (decided & matching).
      // Skip silently if every key is unknown — same partial-enrichment rationale.
      const decidedClauses = then.anyOf.filter((p) => {
        const v = attrs[p.key]
        return v !== undefined && v !== null
      })
      if (decidedClauses.length === 0) continue
      consequentHolds = decidedClauses.some((p) => attrs[p.key] === p.value)
    }

    if (!consequentHolds) {
      violations.push({
        constraintId: constraint.id,
        reason: constraint.reason,
        attributeKey: constraint.if.key,
        currentValue: ifValue,
      })
    }
  }

  return violations
}

/**
 * Build a stable, human-readable dispute reason that includes the constraint
 * id so admin reviewers can trace it back to the JSON rule.
 */
export function violationToDisputeReason(v: Violation): string {
  return `[constraint:${v.constraintId}] ${v.reason}`
}
