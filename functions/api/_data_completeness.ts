/**
 * DQ.31 - canonical data-completeness score and release-gate evaluation.
 *
 * Score is normalized to [0, 1] so it aligns directly with gate thresholds
 * in ROADMAP's canonical gate block.
 */

export interface DataCompletenessInputs {
  globalCompleteness: number
  categoryCompleteness: Record<string, number>
  evidenceCoverage: number
  sourceIdCoverage: number
  openHighPriorityDisputes: number
  disputeBudget: number
  categoryFloorThreshold: number
  warnScoreThreshold: number
  failScoreThreshold: number
}

export interface DataCompletenessResult {
  score: number
  components: {
    global: number
    categoryFloor: number
    evidence: number
    sourceId: number
    disputeHealth: number
  }
  weights: {
    global: number
    categoryFloor: number
    evidence: number
    sourceId: number
    disputeHealth: number
  }
  categoryFloorScore: number
  gate: {
    warn: boolean
    fail: boolean
    warnThreshold: number
    failThreshold: number
    categoryFloorThreshold: number
    disputeBudget: number
    categoriesBelowFloor: string[]
  }
}

const WEIGHTS = {
  global: 0.35,
  categoryFloor: 0.25,
  evidence: 0.2,
  sourceId: 0.1,
  disputeHealth: 0.1,
} as const

function clamp01(n: number): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function computeDataCompletenessScore(inputs: DataCompletenessInputs): DataCompletenessResult {
  const global = clamp01(inputs.globalCompleteness)
  const evidence = clamp01(inputs.evidenceCoverage)
  const sourceId = clamp01(inputs.sourceIdCoverage)
  const disputeBudget = Math.max(1, Math.trunc(inputs.disputeBudget || 0))
  const openDisputes = Math.max(0, Math.trunc(inputs.openHighPriorityDisputes || 0))

  const categoryPairs = Object.entries(inputs.categoryCompleteness)
  const categoriesBelowFloor = categoryPairs
    .filter(([, value]) => clamp01(value) < clamp01(inputs.categoryFloorThreshold))
    .map(([category]) => category)
    .sort()

  const categoryScores = categoryPairs.map(([, value]) => clamp01(value))
  const categoryFloorScore = categoryScores.length > 0 ? Math.min(...categoryScores) : 0
  const disputeHealth = 1 - clamp01(openDisputes / disputeBudget)

  const weighted =
    WEIGHTS.global * global +
    WEIGHTS.categoryFloor * categoryFloorScore +
    WEIGHTS.evidence * evidence +
    WEIGHTS.sourceId * sourceId +
    WEIGHTS.disputeHealth * disputeHealth

  const score = Math.round(weighted * 10000) / 10000
  const warnThreshold = clamp01(inputs.warnScoreThreshold)
  const failThreshold = clamp01(inputs.failScoreThreshold)
  const categoryFloorThreshold = clamp01(inputs.categoryFloorThreshold)
  const warn = score < warnThreshold || categoriesBelowFloor.length > 0
  const fail = score < failThreshold || categoriesBelowFloor.length > 0 || openDisputes > disputeBudget

  return {
    score,
    components: {
      global,
      categoryFloor: categoryFloorScore,
      evidence,
      sourceId,
      disputeHealth,
    },
    weights: { ...WEIGHTS },
    categoryFloorScore,
    gate: {
      warn,
      fail,
      warnThreshold,
      failThreshold,
      categoryFloorThreshold,
      disputeBudget,
      categoriesBelowFloor,
    },
  }
}