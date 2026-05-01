/**
 * DQ.7 — data-health scoring helper.
 *
 * Pure functions so they can be unit-tested without a D1 mock. The scoring
 * formula is deliberately simple and documented so admin users can reason
 * about why the number moved.
 *
 *   data_health_score (0–100) = 100 * weighted_average(
 *     0.30 × coverage_pct,         // % of (character × active attr) cells filled
 *     0.30 × evidence_pct,         // % of attribute rows with evidence text
 *     0.25 × agreement_avg,        // AVG(agreement_score) on non-null rows
 *     0.15 × (1 − dispute_density) // 1 − clamp(open_disputes / max(rows, 1), 0, 1)
 *   )
 *
 * golden_pass_rate and vision_pass_rate, when present, replace the evidence
 * weight (golden) and agreement weight (vision) respectively. They are
 * captured by CI / the enrichment pipeline and threaded through the snapshot
 * writer; when missing, the live API falls back to the D1-derived metrics.
 */

export interface DataHealthInputs {
  /** Filled cells / (characters × active attributes). [0, 1]. */
  coveragePct: number
  /** character_attributes rows with non-null evidence / total rows. [0, 1]. */
  evidencePct: number
  /** AVG(agreement_score) over non-null rows; 0 when no signals yet. [0, 1]. */
  agreementAvg: number
  /** Count of open disputes (numerator). */
  openDisputes: number
  /** Total character_attributes rows (denominator for dispute density). */
  attributeRows: number
}

export interface DataHealthBreakdown {
  score: number
  weights: { coverage: number; evidence: number; agreement: number; disputeHealth: number }
  components: { coverage: number; evidence: number; agreement: number; disputeHealth: number }
}

const WEIGHTS = { coverage: 0.30, evidence: 0.30, agreement: 0.25, disputeHealth: 0.15 } as const

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function computeDataHealthScore(inputs: DataHealthInputs): DataHealthBreakdown {
  const coverage = clamp01(inputs.coveragePct)
  const evidence = clamp01(inputs.evidencePct)
  const agreement = clamp01(inputs.agreementAvg)
  const denom = Math.max(inputs.attributeRows, 1)
  const disputeDensity = clamp01(inputs.openDisputes / denom)
  const disputeHealth = 1 - disputeDensity

  const weighted =
    WEIGHTS.coverage * coverage +
    WEIGHTS.evidence * evidence +
    WEIGHTS.agreement * agreement +
    WEIGHTS.disputeHealth * disputeHealth

  return {
    score: Math.round(weighted * 100 * 10) / 10,
    weights: { ...WEIGHTS },
    components: { coverage, evidence, agreement, disputeHealth },
  }
}
