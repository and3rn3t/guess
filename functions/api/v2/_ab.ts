// A/B variant assignment for engine experiments.
//
// Reads three KV flags written by the admin panel:
//   kv:ab:experiment-pct       — string, 0-100 percent of new sessions to bucket into experiment
//   kv:ab:experiment-selector  — 'greedy' | 'mcts' | (anything else falls back to default)
//   kv:ab:experiment-weights   — JSON ScoringWeights override (optional, future use)
//
// Also supports a dedicated rollout flag for question expansion:
//   kv:ff:question_expansion_v1_pct       — string, 0-100
//   kv:ff:question_expansion_v1_selector  — 'greedy' | 'mcts'
//
// Bucketing is deterministic per (userId, day) so a single user gets a stable
// variant within a day — prevents the same user flipping between variants
// across consecutive games.

export type EngineVariant = 'control' | 'experiment'
export type EngineSelector = 'greedy' | 'mcts'

/** Default selector for the control group. Matches the historical wrapper behavior
 *  in `_game-engine.ts` (`selectBestQuestion` → `_selectBestQuestionMCTS`). */
export const DEFAULT_SELECTOR: EngineSelector = 'mcts'

export interface VariantAssignment {
  variant: EngineVariant
  selector: EngineSelector
}

const KV_PCT = 'ab:experiment-pct'
const KV_SELECTOR = 'ab:experiment-selector'
const KV_QE_PCT = 'ff:question_expansion_v1_pct'
const KV_QE_SELECTOR = 'ff:question_expansion_v1_selector'

/** Hash a string to a 0-99 bucket. djb2 — small, deterministic, no deps. */
function bucket(input: string): number {
  let h = 5381
  for (const ch of input) {
    h = Math.trunc((h << 5) + h + (ch.codePointAt(0) ?? 0))
  }
  return Math.abs(h) % 100
}

function isSelector(s: string | null): s is EngineSelector {
  return s === 'greedy' || s === 'mcts'
}

/** Decide which engine variant + selector to assign to a new session. */
export async function assignVariant(
  kv: KVNamespace,
  userId: string
): Promise<VariantAssignment> {
  // All reads in parallel; keys may be null on a cold KV.
  const [pctStr, selectorStr, questionExpansionPctStr, questionExpansionSelectorStr] = await Promise.all([
    kv.get(KV_PCT),
    kv.get(KV_SELECTOR),
    kv.get(KV_QE_PCT),
    kv.get(KV_QE_SELECTOR),
  ])

  // Dedicated Phase 4 rollout flag uses stable per-user bucketing so users
  // stay in one cohort across days and difficulties.
  const questionExpansionPct = questionExpansionPctStr
    ? Number.parseInt(questionExpansionPctStr, 10)
    : 0
  if (Number.isFinite(questionExpansionPct) && questionExpansionPct > 0) {
    const inExpansion = bucket(userId) < questionExpansionPct
    if (!inExpansion) {
      return { variant: 'control', selector: DEFAULT_SELECTOR }
    }
    const selector = isSelector(questionExpansionSelectorStr)
      ? questionExpansionSelectorStr
      : DEFAULT_SELECTOR
    return { variant: 'experiment', selector }
  }

  const pct = pctStr ? Number.parseInt(pctStr, 10) : 0
  if (!Number.isFinite(pct) || pct <= 0) {
    return { variant: 'control', selector: DEFAULT_SELECTOR }
  }

  const day = new Date().toISOString().slice(0, 10)
  const inExperiment = bucket(`${userId}:${day}`) < pct

  if (!inExperiment) {
    return { variant: 'control', selector: DEFAULT_SELECTOR }
  }

  const selector = isSelector(selectorStr) ? selectorStr : DEFAULT_SELECTOR
  return { variant: 'experiment', selector }
}
