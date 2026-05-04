export type RiskTier = 'tier1' | 'tier2' | 'tier3'

export interface RiskTierCandidate {
  id: string
  name: string
  category: string
  popularity: number | null
  plays30d: number | null
  openDisputes: number | null
  agreementAvg: number | null
  lastValidatedAt: number | null
}

export interface RankedRiskTierCandidate extends RiskTierCandidate {
  tier: RiskTier
  riskScore: number
  staleDays: number
}

export interface RiskTierSelection {
  tier: RiskTier
  selected: RankedRiskTierCandidate[]
  allRanked: RankedRiskTierCandidate[]
  coverage: {
    totalCandidates: number
    tierCandidates: number
    selectedCount: number
    selectedPctOfTier: number
    selectedPctOfCatalog: number
  }
}

interface RiskTierOptions {
  limit?: number
  nowMs?: number
}

function getDefaultLimitForTier(tier: RiskTier): number {
  if (tier === 'tier1') return 50
  if (tier === 'tier2') return 120
  return 200
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function toEpochMs(value: number | null | undefined): number | null {
  if (!value || value <= 0) return null
  // D1 rows in this project can be seconds (unixepoch) or ms; normalize to ms.
  return value >= 1_000_000_000_000 ? value : value * 1000
}

function computeStaleDays(lastValidatedAt: number | null, nowMs: number): number {
  const validatedMs = toEpochMs(lastValidatedAt)
  if (!validatedMs) return 365
  const diffMs = Math.max(0, nowMs - validatedMs)
  return Math.floor(diffMs / 86_400_000)
}

function computeRiskScore(candidate: RiskTierCandidate, maxPlays: number, nowMs: number): { riskScore: number; staleDays: number } {
  const plays30d = Math.max(0, toNumber(candidate.plays30d))
  const openDisputes = Math.max(0, toNumber(candidate.openDisputes))
  const agreementAvg = candidate.agreementAvg == null ? 0.75 : clamp01(toNumber(candidate.agreementAvg))
  const staleDays = computeStaleDays(candidate.lastValidatedAt, nowMs)

  const playsNorm = maxPlays > 0 ? Math.log1p(plays30d) / Math.log1p(maxPlays) : 0
  const disputeNorm = clamp01(openDisputes / 5)
  const disagreementNorm = 1 - agreementAvg
  const staleNorm = clamp01(staleDays / 90)

  const riskScore =
    0.45 * playsNorm +
    0.25 * disputeNorm +
    0.2 * disagreementNorm +
    0.1 * staleNorm

  return {
    riskScore: Number(riskScore.toFixed(6)),
    staleDays,
  }
}

function rankCandidates(candidates: readonly RiskTierCandidate[], nowMs: number): RankedRiskTierCandidate[] {
  const maxPlays = candidates.reduce((max, candidate) => {
    return Math.max(max, Math.max(0, toNumber(candidate.plays30d)))
  }, 0)

  return candidates
    .map((candidate) => {
      const { riskScore, staleDays } = computeRiskScore(candidate, maxPlays, nowMs)
      return {
        ...candidate,
        riskScore,
        staleDays,
        tier: 'tier3' as RiskTier,
      }
    })
    .sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
      if (b.staleDays !== a.staleDays) return b.staleDays - a.staleDays
      return a.id.localeCompare(b.id)
    })
}

function assignTiers(sorted: readonly RankedRiskTierCandidate[]): RankedRiskTierCandidate[] {
  const total = sorted.length
  if (total === 0) return []

  const tier1Cutoff = Math.max(1, Math.ceil(total * 0.2))
  const tier2Cutoff = Math.max(tier1Cutoff + 1, Math.ceil(total * 0.6))

  return sorted.map((candidate, index) => {
    if (index < tier1Cutoff) return { ...candidate, tier: 'tier1' as const }
    if (index < tier2Cutoff) return { ...candidate, tier: 'tier2' as const }
    return { ...candidate, tier: 'tier3' as const }
  })
}

export function selectRiskTierSample(
  candidates: readonly RiskTierCandidate[],
  tier: RiskTier,
  options: RiskTierOptions = {},
): RiskTierSelection {
  const defaultLimit = getDefaultLimitForTier(tier)
  const limit = Math.max(1, Math.trunc(options.limit ?? defaultLimit))
  const nowMs = options.nowMs ?? Date.now()
  const ranked = rankCandidates(candidates, nowMs)
  const withTiers = assignTiers(ranked)
  const tierCandidates = withTiers.filter((candidate) => candidate.tier === tier)
  const selected = tierCandidates.slice(0, limit)

  const tierCount = tierCandidates.length
  const totalCount = withTiers.length
  return {
    tier,
    selected,
    allRanked: withTiers,
    coverage: {
      totalCandidates: totalCount,
      tierCandidates: tierCount,
      selectedCount: selected.length,
      selectedPctOfTier: tierCount > 0 ? selected.length / tierCount : 0,
      selectedPctOfCatalog: totalCount > 0 ? selected.length / totalCount : 0,
    },
  }
}
