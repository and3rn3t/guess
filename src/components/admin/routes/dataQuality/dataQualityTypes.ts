export interface LiveSnapshot {
  capturedAt: number
  dataHealthScore: number
  components: { coverage: number; evidence: number; agreement: number; disputeHealth: number }
  weights: { coverage: number; evidence: number; agreement: number; disputeHealth: number }
  coveragePct: number
  evidencePct: number
  agreementAvg: number
  agreementSampleSize: number
  openDisputes: number
  totalCharacters: number
  activeAttributes: number
  attributeRows: number
  completeness: {
    dataCompleteScore: number
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
    categoryCompleteness: Record<string, number>
    globalCompleteness: number
    evidenceCoverage: number
    sourceIdCoverage: number
    openHighPriorityDisputes: number
    totalRequiredCells: number
    filledRequiredCells: number
    gate: {
      warn: boolean
      fail: boolean
      warnThreshold: number
      failThreshold: number
      categoryFloorThreshold: number
      disputeBudget: number
      categoriesBelowFloor: string[]
    }
    config: {
      warnScore: number
      failScore: number
      defaultCategoryFloor: number
      disputeBudget: number
    }
  }
}

export interface HistoryRow {
  captured_at: number
  data_health_score: number
  coverage_pct: number
  evidence_pct: number
  agreement_avg: number
  open_disputes: number
  golden_pass_rate: number | null
  vision_pass_rate: number | null
  closure_total_pairs: number | null
  closure_automation_pairs: number | null
  closure_manual_pairs: number | null
}

export interface DataQualityResponse {
  live: LiveSnapshot
  history: HistoryRow[]
  windowDays: number
}

export interface ClosureQueueResponse {
  generatedAt: string
  limit: number
  lanePolicy: {
    automationScoreThreshold: number
    automationMinConfidenceGap: number
  }
  totalCandidatePairs: number
  summary: {
    totalPairs: number
    automationPairs: number
    manualPairs: number
    categories: Record<string, number>
    attributes: Record<string, number>
  }
  queue: Array<{
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
  }>
}

export interface ClosureQueueStatusResponse {
  report: {
    generatedAt: string
    summary: {
      totalPairs: number
      automationPairs: number
      manualPairs: number
    }
  } | null
  fetchedAt: number
}

export interface SourceHealthResponse {
  generatedAt: string
  totals: {
    totalCharacters: number
    validCharacters: number
    issueCount: number
    coveragePct: number
  }
  perSource: Array<{
    source: string
    total: number
    valid: number
    missing: number
    malformed: number
    coveragePct: number
  }>
  issues: Array<{
    characterId: string
    characterName: string
    category: string
    source: string
    sourceId: string | null
    issueType: string
    reason: string
    popularity: number
    agedDays: number
    createdAt: number
  }>
}

export interface SourceHealthStatusResponse {
  report: {
    generatedAt: string
    totals: {
      totalCharacters: number
      validCharacters: number
      issueCount: number
      coveragePct: number
    }
  } | null
  fetchedAt: number
}
