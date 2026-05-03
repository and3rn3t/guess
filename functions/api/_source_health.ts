export interface SourceHealthCharacterRow {
  id: string
  name: string
  category: string
  source: string | null
  source_id: string | null
  popularity: number | null
  created_at: number | null
}

export type SourceHealthIssueType =
  | 'missing-source'
  | 'missing-source-id'
  | 'malformed-source-id'
  | 'unknown-source'

export interface SourceHealthIssue {
  characterId: string
  characterName: string
  category: string
  source: string
  sourceId: string | null
  issueType: SourceHealthIssueType
  reason: string
  popularity: number
  agedDays: number
  createdAt: number
}

export interface SourceHealthPerSource {
  source: string
  total: number
  valid: number
  missing: number
  malformed: number
  coveragePct: number
}

export interface SourceHealthReport {
  generatedAt: string
  totals: {
    totalCharacters: number
    validCharacters: number
    issueCount: number
    coveragePct: number
  }
  perSource: SourceHealthPerSource[]
  issues: SourceHealthIssue[]
}

export const SOURCE_HEALTH_REPORT_KEY = 'admin:data-quality:source-health:last'

const TRACKED_SOURCES = ['tmdb', 'anilist', 'igdb', 'comicvine', 'wikidata'] as const

const SOURCE_ID_PATTERNS: Record<(typeof TRACKED_SOURCES)[number], RegExp> = {
  tmdb: /^\d+$/,
  anilist: /^\d+$/,
  igdb: /^\d+$/,
  comicvine: /^(\d+|\d+-\d+)$/,
  wikidata: /^Q\d+$/i,
}

function isTrackedSource(source: string): source is (typeof TRACKED_SOURCES)[number] {
  return TRACKED_SOURCES.includes(source as (typeof TRACKED_SOURCES)[number])
}

interface SourceClassification {
  canonicalSource: string
  sourceId: string | null
  issueType: SourceHealthIssueType | null
  reason: string | null
  isValid: boolean
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function computeAgedDays(createdAtUnixSeconds: number | null | undefined): number {
  if (!createdAtUnixSeconds || createdAtUnixSeconds <= 0) return 0
  const nowSeconds = Math.floor(Date.now() / 1000)
  const ageSeconds = Math.max(0, nowSeconds - createdAtUnixSeconds)
  return Math.floor(ageSeconds / 86400)
}


function normalizeSource(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeSourceId(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  return value.length > 0 ? value : null
}

function canonicalizeSource(raw: string): string {
  const key = normalizeSource(raw)
  if (key === 'comicvineapi') return 'comicvine'
  if (key === 'comicvine') return 'comicvine'
  if (key === 'themoviedb') return 'tmdb'
  return key
}

function classifySource(sourceRaw: string | null | undefined, sourceIdRaw: string | null | undefined): SourceClassification {
  const canonicalSource = canonicalizeSource(sourceRaw ?? '')
  const sourceId = normalizeSourceId(sourceIdRaw)

  if (canonicalSource.length === 0) {
    return {
      canonicalSource: 'unknown',
      sourceId,
      issueType: 'missing-source',
      reason: 'Source is empty.',
      isValid: false,
    }
  }

  if (canonicalSource === 'default') {
    return {
      canonicalSource,
      sourceId,
      issueType: null,
      reason: null,
      isValid: true,
    }
  }

  if (!isTrackedSource(canonicalSource)) {
    return {
      canonicalSource,
      sourceId,
      issueType: 'unknown-source',
      reason: `Unrecognized source: ${canonicalSource}`,
      isValid: false,
    }
  }

  if (!sourceId) {
    return {
      canonicalSource,
      sourceId,
      issueType: 'missing-source-id',
      reason: `${canonicalSource} source is missing source_id.`,
      isValid: false,
    }
  }

  const regex = SOURCE_ID_PATTERNS[canonicalSource]
  if (!regex.test(sourceId)) {
    return {
      canonicalSource,
      sourceId,
      issueType: 'malformed-source-id',
      reason: `${canonicalSource} source_id format is invalid: ${sourceId}`,
      isValid: false,
    }
  }

  return {
    canonicalSource,
    sourceId,
    issueType: null,
    reason: null,
    isValid: true,
  }
}

export function computeSourceHealthReport(
  rows: readonly SourceHealthCharacterRow[],
  options: { issueLimit?: number; generatedAt?: string } = {},
): SourceHealthReport {
  const issueLimit = Math.min(Math.max(Math.trunc(options.issueLimit ?? 200), 1), 1000)
  const generatedAt = options.generatedAt ?? new Date().toISOString()

  const perSourceMap = new Map<string, { total: number; valid: number; missing: number; malformed: number }>()
  for (const source of TRACKED_SOURCES) {
    perSourceMap.set(source, { total: 0, valid: 0, missing: 0, malformed: 0 })
  }

  const issues: SourceHealthIssue[] = []
  let validCharacters = 0

  for (const row of rows) {
    const source = canonicalizeSource(row.source ?? '')
    const classification = classifySource(row.source, row.source_id)

    if (isTrackedSource(source)) {
      const sourceBucket = perSourceMap.get(source)
      if (sourceBucket) sourceBucket.total += 1
      if (classification.isValid) {
        if (sourceBucket) sourceBucket.valid += 1
      } else if (classification.issueType === 'missing-source-id') {
        if (sourceBucket) sourceBucket.missing += 1
      } else if (classification.issueType === 'malformed-source-id') {
        if (sourceBucket) sourceBucket.malformed += 1
      }
    }

    if (classification.isValid) {
      validCharacters += 1
      continue
    }

    if (!classification.issueType || !classification.reason) continue

    const agedDays = computeAgedDays(row.created_at)
    issues.push({
      characterId: row.id,
      characterName: row.name,
      category: row.category,
      source: classification.canonicalSource,
      sourceId: classification.sourceId,
      issueType: classification.issueType,
      reason: classification.reason,
      popularity: num(row.popularity),
      agedDays,
      createdAt: num(row.created_at),
    })
  }

  const perSource: SourceHealthPerSource[] = [...perSourceMap.entries()].map(([source, counts]) => ({
    source,
    total: counts.total,
    valid: counts.valid,
    missing: counts.missing,
    malformed: counts.malformed,
    coveragePct: counts.total > 0 ? counts.valid / counts.total : 1,
  }))

  const sortedIssues = issues
    .sort((a, b) => {
      if (b.agedDays !== a.agedDays) return b.agedDays - a.agedDays
      if (b.popularity !== a.popularity) return b.popularity - a.popularity
      if (a.source !== b.source) return a.source.localeCompare(b.source)
      return a.characterName.localeCompare(b.characterName)
    })
    .slice(0, issueLimit)

  return {
    generatedAt,
    totals: {
      totalCharacters: rows.length,
      validCharacters,
      issueCount: issues.length,
      coveragePct: rows.length > 0 ? validCharacters / rows.length : 1,
    },
    perSource,
    issues: sortedIssues,
  }
}
