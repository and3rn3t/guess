/**
 * DQ.36 — manual curator closure queue.
 *
 * Analyzes rows that cannot be auto-resolved (cannot_infer, canon_conflict, subjective)
 * and produces a prioritized queue for human review. Tracks assignment, resolution,
 * and locks to prevent endless reprocessing loops.
 */

export type CurationIssueType = 'cannot_infer' | 'canon_conflict' | 'subjective'

export interface CurationQueueRow {
  id: number
  character_id: string
  attribute_key: string
  issue_type: CurationIssueType
  issue_reason: string
  category: string
  assigned_to: string | null
  resolved_at: number | null
  resolution_reason: string | null
  resolution_value: string | null
  locked_until: number | null
  lock_reason: string | null
  created_at: number
  updated_at: number
  popularity: number
  priority_score: number
}

export interface CurationQueueItem {
  id: number
  characterId: string
  attributeKey: string
  issueType: CurationIssueType
  issueReason: string
  category: string
  assignedTo: string | null
  resolvedAt: number | null
  resolutionReason: string | null
  locked: boolean
  lockedUntil: number | null
  lockReason: string | null
  createdAt: number
  agedDays: number
  popularity: number
  priorityScore: number
}

export interface CurationQueueReport {
  totals: {
    totalItems: number
    unresolved: number
    assigned: number
    locked: number
    avgAgedDays: number
  }
  perIssueType: Record<CurationIssueType, { count: number; percentOfTotal: number }>
  items: CurationQueueItem[]
}

export interface BuildCurationQueueReportOptions {
  limit?: number
  issueTypeFilter?: CurationIssueType[]
  onlyUnresolved?: boolean
  onlyLocked?: boolean
  onlyAssigned?: boolean
  nowMs?: number
}

/**
 * Compute aged days since creation
 */
function computeAgedDays(createdAtMs: number, nowMs: number = Date.now()): number {
  const dayMs = 86400000
  return Math.floor((nowMs - createdAtMs) / dayMs)
}

/**
 * Transform DB row to API item
 */
function rowToItem(row: CurationQueueRow, nowMs: number = Date.now()): CurationQueueItem {
  const agedDays = computeAgedDays(row.created_at, nowMs)
  const locked = row.locked_until !== null && row.locked_until > nowMs

  return {
    id: row.id,
    characterId: row.character_id,
    attributeKey: row.attribute_key,
    issueType: row.issue_type,
    issueReason: row.issue_reason,
    category: row.category,
    assignedTo: row.assigned_to,
    resolvedAt: row.resolved_at,
    resolutionReason: row.resolution_reason,
    locked,
    lockedUntil: row.locked_until,
    lockReason: row.lock_reason,
    createdAt: row.created_at,
    agedDays,
    popularity: row.popularity,
    priorityScore: row.priority_score,
  }
}

/**
 * Build curator queue report from raw rows
 */
export function buildCurationQueueReport(
  rows: CurationQueueRow[],
  options: BuildCurationQueueReportOptions = {},
): CurationQueueReport {
  const {
    limit = 200,
    issueTypeFilter,
    onlyUnresolved = true,
    onlyLocked = false,
    onlyAssigned = false,
    nowMs = Date.now(),
  } = options

  // Apply filters
  const filtered = rows.filter((row) => {
    if (onlyUnresolved && row.resolved_at !== null) return false
    if (onlyLocked && (row.locked_until === null || row.locked_until <= nowMs)) return false
    if (onlyAssigned && row.assigned_to === null) return false
    if (issueTypeFilter && !issueTypeFilter.includes(row.issue_type)) return false
    return true
  })

  // Sort by priority score descending, then by age descending
  filtered.sort((a, b) => {
    const aDays = computeAgedDays(a.created_at, nowMs)
    const bDays = computeAgedDays(b.created_at, nowMs)
    const aScore = a.priority_score !== 0 ? a.priority_score : 0
    const bScore = b.priority_score !== 0 ? b.priority_score : 0

    if (bScore !== aScore) return bScore - aScore
    return bDays - aDays
  })

  // Apply limit
  const items = filtered.slice(0, limit).map((row) => rowToItem(row, nowMs))

  // Compute aggregates
  const unresolved = rows.filter((r) => r.resolved_at === null).length
  const assigned = rows.filter((r) => r.assigned_to !== null && r.resolved_at === null).length
  const locked = rows.filter((r) => r.locked_until !== null && r.locked_until > nowMs).length
  const agedDaysAll = rows.map((r) => computeAgedDays(r.created_at, nowMs))
  const avgAgedDays = agedDaysAll.length > 0 ? Math.round(agedDaysAll.reduce((a, b) => a + b, 0) / agedDaysAll.length) : 0

  // Per-issue-type breakdown (of all rows, not filtered)
  const perIssueType: Record<CurationIssueType, { count: number; percentOfTotal: number }> = {
    cannot_infer: { count: 0, percentOfTotal: 0 },
    canon_conflict: { count: 0, percentOfTotal: 0 },
    subjective: { count: 0, percentOfTotal: 0 },
  }

  for (const row of rows) {
    perIssueType[row.issue_type].count++
  }

  const total = rows.length
  if (total > 0) {
    for (const type of Object.keys(perIssueType) as CurationIssueType[]) {
      perIssueType[type].percentOfTotal = Math.round((perIssueType[type].count / total) * 1000) / 10 // 0.1% precision
    }
  }

  return {
    totals: {
      totalItems: total,
      unresolved,
      assigned,
      locked,
      avgAgedDays,
    },
    perIssueType,
    items,
  }
}
