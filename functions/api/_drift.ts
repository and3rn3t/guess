/**
 * Attribute drift detection (DQ.6 / AN.26)
 *
 * Pure logic: given the stored attribute map for a character (the value
 * currently in `character_attributes`) and a "fresh" map produced by a
 * reconciliation source (today: re-running the LLM enrichment with the
 * canonical prompt; future: SPARQL re-fetch, vision re-classify, etc.),
 * return the list of drift events to insert into `attribute_drift`.
 *
 * Drift is recorded in three cases:
 *   1. stored has a value, fresh has a *different* value (the classic flip)
 *   2. stored has a value, fresh is null/undefined  → 'lost' signal
 *   3. stored is null, fresh now has a value         → 'discovered' signal
 *
 * Symmetric absence (both null/undefined) is *not* drift.
 * Equal values are *not* drift.
 */

export type AttributeValue = 0 | 1 | null

export interface AttributeMap {
  [attributeKey: string]: AttributeValue | undefined
}

export interface DriftEvent {
  attributeKey: string
  oldValue: AttributeValue
  newValue: AttributeValue
  /** true iff stored had a value and fresh contradicts it (case 1 above). */
  isContradiction: boolean
}

export interface ComputeDriftOptions {
  /**
   * If provided, only attributes in this set are considered. Useful when a
   * reconciliation source can only speak to a subset (e.g. vision validator
   * → visual attributes only).
   */
  attributeAllowList?: ReadonlySet<string>
  /**
   * If true, "discovered" events (stored=null → fresh has value) are emitted.
   * Default true.
   */
  emitDiscovered?: boolean
  /**
   * If true, "lost" events (stored has value → fresh=null) are emitted.
   * Default false — most reconciliation sources can't reliably distinguish
   * "I don't know" from "absent", so noise risk is high. Toggle on per source.
   */
  emitLost?: boolean
}

function normalize(v: AttributeValue | undefined): AttributeValue {
  if (v === 1 || v === 0) return v
  return null
}

function classify(
  oldValue: AttributeValue,
  newValue: AttributeValue,
  emitDiscovered: boolean,
  emitLost: boolean
): DriftEvent | null {
  if (oldValue === newValue) return null
  if (oldValue === null && newValue !== null) {
    return emitDiscovered
      ? { attributeKey: '', oldValue, newValue, isContradiction: false }
      : null
  }
  if (oldValue !== null && newValue === null) {
    return emitLost
      ? { attributeKey: '', oldValue, newValue, isContradiction: false }
      : null
  }
  return { attributeKey: '', oldValue, newValue, isContradiction: true }
}

/**
 * Compute drift events between a stored attribute map and a fresh one.
 *
 * Caller responsibilities:
 *   • Pass *all* known stored keys, not just the ones the fresh source returned
 *     (otherwise "lost" signals are missed).
 *   • Apply `attributeAllowList` if the fresh source can only speak to a subset.
 */
export function computeDrift(
  stored: AttributeMap,
  fresh: AttributeMap,
  opts: ComputeDriftOptions = {}
): DriftEvent[] {
  const { attributeAllowList, emitDiscovered = true, emitLost = false } = opts

  const events: DriftEvent[] = []
  const keys = new Set<string>([...Object.keys(stored), ...Object.keys(fresh)])

  for (const key of keys) {
    if (attributeAllowList && !attributeAllowList.has(key)) continue
    const oldValue = normalize(stored[key])
    const newValue = normalize(fresh[key])
    const event = classify(oldValue, newValue, emitDiscovered, emitLost)
    if (event) {
      event.attributeKey = key
      events.push(event)
    }
  }

  // Stable sort for deterministic output (helps tests + diff review).
  events.sort((a, b) => a.attributeKey.localeCompare(b.attributeKey))
  return events
}

/**
 * Summary stats for a batch of drift events — drives admin widgets and
 * GitHub Actions step summaries.
 */
export interface DriftSummary {
  total: number
  contradictions: number
  discovered: number
  lost: number
}

export function summarizeDrift(events: ReadonlyArray<DriftEvent>): DriftSummary {
  let contradictions = 0
  let discovered = 0
  let lost = 0
  for (const e of events) {
    if (e.isContradiction) contradictions++
    else if (e.oldValue === null) discovered++
    else lost++
  }
  return { total: events.length, contradictions, discovered, lost }
}
