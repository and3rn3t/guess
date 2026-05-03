import { useEffect, useState } from 'react'
import { AdminPageHeader } from '../AdminPageHeader'
import { SlaTargetsPanel } from '../SlaTargetsPanel'
import { ImageHealthPanel } from '../ImageHealthPanel'
import { CuratorQueuePanel } from '../CuratorQueuePanel'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface LiveSnapshot {
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

interface HistoryRow {
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

interface DataQualityResponse {
  live: LiveSnapshot
  history: HistoryRow[]
  windowDays: number
}

interface ClosureQueueResponse {
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

interface ClosureQueueStatusResponse {
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

interface SourceHealthResponse {
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

interface SourceHealthStatusResponse {
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

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function fmtPctPrecise(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

function fmtPp(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)} pp`
}

function gateTone(snapshot: LiveSnapshot): {
  label: 'PASS' | 'WARN' | 'FAIL'
  className: string
  hint: string
} {
  const { gate } = snapshot.completeness
  if (gate.fail) {
    return {
      label: 'FAIL',
      className: 'border-destructive/40 bg-destructive/10 text-destructive',
      hint: 'Below fail threshold, below category floor, or disputes exceed budget.',
    }
  }
  if (gate.warn) {
    return {
      label: 'WARN',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      hint: 'Warn-only rollout is surfacing completeness drift before enforcement.',
    }
  }
  return {
    label: 'PASS',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    hint: 'Score, category floor, and dispute budget are all healthy.',
  }
}

function Kpi({
  label,
  value,
  hint,
}: Readonly<{ label: string; value: string; hint?: string }>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: Readonly<{ title: string; subtitle?: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

interface TrendChartProps {
  title: string
  data: { day: string; value: number }[]
  stroke: string
  yDomain?: [number, number]
  yFormat?: (v: number) => string
  emptyHint: string
}

function TrendChart({ title, data, stroke, yDomain, yFormat, emptyHint }: Readonly<TrendChartProps>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={yDomain ?? ['auto', 'auto']}
                tickFormatter={yFormat}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: unknown) => {
                  const n = typeof value === 'number' ? value : Number(value)
                  return yFormat ? yFormat(n) : n
                }}
              />
              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

interface LaneMixChartProps {
  title: string
  data: Array<{ day: string; automation: number; manual: number }>
  emptyHint: string
}

function LaneMixChart({ title, data, emptyHint }: Readonly<LaneMixChartProps>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: unknown, name) => {
                  const n = typeof value === 'number' ? value : Number(value)
                  const label = name === 'automation' ? 'Automation share' : 'Manual share'
                  return [`${(n * 100).toFixed(1)}%`, label]
                }}
              />
              <Line type="monotone" dataKey="automation" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="manual" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function toDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

function relativeFromIso(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return 'unknown'
  const deltaMs = Math.max(0, Date.now() - ts)
  const mins = Math.floor(deltaMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatAutomationShareDelta(delta: number | null): string {
  return delta === null ? 'n/a' : fmtPp(delta)
}

interface TrendSeriesData {
  goldenSeries: Array<{ day: string; value: number }>
  visionSeries: Array<{ day: string; value: number }>
  agreementSeries: Array<{ day: string; value: number }>
  disputeSeries: Array<{ day: string; value: number }>
  healthSeries: Array<{ day: string; value: number }>
  closureTotalSeries: Array<{ day: string; value: number }>
  closureAutomationSeries: Array<{ day: string; value: number }>
  closureManualSeries: Array<{ day: string; value: number }>
  closureLaneMixSeries: Array<{ day: string; automation: number; manual: number }>
  latestLaneMix: { day: string; automation: number; manual: number } | null
  automationShareDeltaPp: number | null
}

function buildTrendSeries(history: HistoryRow[]): TrendSeriesData {
  const goldenSeries = history
    .filter((row) => row.golden_pass_rate !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.golden_pass_rate as number }))
  const visionSeries = history
    .filter((row) => row.vision_pass_rate !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.vision_pass_rate as number }))
  const agreementSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.agreement_avg }))
  const disputeSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.open_disputes }))
  const healthSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.data_health_score }))
  const closureTotalSeries = history
    .filter((row) => row.closure_total_pairs !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.closure_total_pairs as number }))
  const closureAutomationSeries = history
    .filter((row) => row.closure_automation_pairs !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.closure_automation_pairs as number }))
  const closureManualSeries = history
    .filter((row) => row.closure_manual_pairs !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.closure_manual_pairs as number }))
  const closureLaneMixSeries = history
    .filter(
      (row) =>
        row.closure_total_pairs !== null &&
        row.closure_total_pairs > 0 &&
        row.closure_automation_pairs !== null &&
        row.closure_manual_pairs !== null,
    )
    .map((row) => {
      const total = row.closure_total_pairs as number
      const automation = (row.closure_automation_pairs as number) / total
      const manual = (row.closure_manual_pairs as number) / total
      return {
        day: toDay(row.captured_at),
        automation,
        manual,
      }
    })
  const latestLaneMix = closureLaneMixSeries.length > 0 ? closureLaneMixSeries[closureLaneMixSeries.length - 1] : null
  const previousLaneMix = closureLaneMixSeries.length > 1 ? closureLaneMixSeries[closureLaneMixSeries.length - 2] : null
  const automationShareDeltaPp =
    latestLaneMix && previousLaneMix
      ? (latestLaneMix.automation - previousLaneMix.automation) * 100
      : null

  return {
    goldenSeries,
    visionSeries,
    agreementSeries,
    disputeSeries,
    healthSeries,
    closureTotalSeries,
    closureAutomationSeries,
    closureManualSeries,
    closureLaneMixSeries,
    latestLaneMix,
    automationShareDeltaPp,
  }
}

export default function DataQualityRoute(): React.JSX.Element {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [closureQueue, setClosureQueue] = useState<ClosureQueueResponse | null>(null)
  const [closureQueueStatus, setClosureQueueStatus] = useState<ClosureQueueStatusResponse | null>(null)
  const [sourceHealth, setSourceHealth] = useState<SourceHealthResponse | null>(null)
  const [sourceHealthStatus, setSourceHealthStatus] = useState<SourceHealthStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/admin/data-quality').then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return (await res.json()) as DataQualityResponse
      }),
      fetch('/api/admin/data-quality/closure-queue?limit=50')
        .then(async (res) => (res.ok ? ((await res.json()) as ClosureQueueResponse) : null))
        .catch(() => null),
      fetch('/api/admin/data-quality/closure-queue-status')
        .then(async (res) => (res.ok ? ((await res.json()) as ClosureQueueStatusResponse) : null))
        .catch(() => null),
      fetch('/api/admin/source-health?limit=20')
        .then(async (res) => (res.ok ? ((await res.json()) as SourceHealthResponse) : null))
        .catch(() => null),
      fetch('/api/admin/source-health-status')
        .then(async (res) => (res.ok ? ((await res.json()) as SourceHealthStatusResponse) : null))
        .catch(() => null),
    ])
      .then(([snapshot, closure, closureStatus, sourceHealthResponse, sourceHealthStatusResponse]) => {
        if (!cancelled) {
          setData(snapshot)
          setClosureQueue(closure)
          setClosureQueueStatus(closureStatus)
          setSourceHealth(sourceHealthResponse)
          setSourceHealthStatus(sourceHealthStatusResponse)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const history = data?.history ?? []
  const {
    goldenSeries,
    visionSeries,
    agreementSeries,
    disputeSeries,
    healthSeries,
    closureTotalSeries,
    closureAutomationSeries,
    closureManualSeries,
    closureLaneMixSeries,
    latestLaneMix,
    automationShareDeltaPp,
  } = buildTrendSeries(history)
  const completenessVerdict = data ? gateTone(data.live) : null
  const categoryRows = data
    ? Object.entries(data.live.completeness.categoryCompleteness).sort((a, b) => a[1] - b[1])
    : []

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Data Quality"
        subtitle={`Live snapshot · trend window ${data?.windowDays ?? 30} days · history written nightly`}
        sectionColor="violet"
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load: {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi
              label="Data health score"
              value={data.live.dataHealthScore.toFixed(1)}
              hint="0–100, weighted: 30/30/25/15"
            />
            <Kpi
              label="Coverage"
              value={fmtPct(data.live.coveragePct)}
              hint={`${data.live.attributeRows.toLocaleString()} / ${(data.live.totalCharacters * data.live.activeAttributes).toLocaleString()} cells`}
            />
            <Kpi
              label="Agreement (avg)"
              value={fmtPct(data.live.agreementAvg)}
              hint={`${data.live.agreementSampleSize.toLocaleString()} scored rows`}
            />
            <Kpi
              label="Open disputes"
              value={data.live.openDisputes.toLocaleString()}
              hint={`evidence on ${fmtPct(data.live.evidencePct)} of rows`}
            />
          </div>

          <SectionCard
            title="Completeness Gate"
            subtitle="Canonical DQ.31 release gate using global completeness, category floor, evidence, source IDs, and high-priority disputes."
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Data complete score"
                  value={data.live.completeness.dataCompleteScore.toFixed(4)}
                  hint={`Warn ${fmtPctPrecise(data.live.completeness.config.warnScore)} · Fail ${fmtPctPrecise(data.live.completeness.config.failScore)}`}
                />
                <Kpi
                  label="Global completeness"
                  value={fmtPctPrecise(data.live.completeness.globalCompleteness)}
                  hint={`${data.live.completeness.filledRequiredCells.toLocaleString()} / ${data.live.completeness.totalRequiredCells.toLocaleString()} required cells`}
                />
                <Kpi
                  label="Category floor"
                  value={fmtPctPrecise(data.live.completeness.categoryFloorScore)}
                  hint={`Floor target ${fmtPctPrecise(data.live.completeness.config.defaultCategoryFloor)}`}
                />
                <Kpi
                  label="Source-ID coverage"
                  value={fmtPctPrecise(data.live.completeness.sourceIdCoverage)}
                  hint={`Evidence coverage ${fmtPctPrecise(data.live.completeness.evidenceCoverage)}`}
                />
              </div>

              <div className={`min-w-65 rounded-lg border px-4 py-3 ${completenessVerdict?.className ?? ''}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">Gate verdict</p>
                <p className="mt-2 text-3xl font-semibold">{completenessVerdict?.label}</p>
                <p className="mt-2 text-sm opacity-90">{completenessVerdict?.hint}</p>
                <p className="mt-3 text-xs opacity-80">
                  High-priority disputes: {data.live.completeness.openHighPriorityDisputes.toLocaleString()} / {data.live.completeness.gate.disputeBudget}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Completeness</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map(([category, value]) => {
                      const belowFloor = value < data.live.completeness.gate.categoryFloorThreshold
                      return (
                        <tr key={category} className="border-t border-border/50">
                          <td className="px-4 py-3 font-medium capitalize text-foreground">{category}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmtPctPrecise(value)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${belowFloor ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}
                            >
                              {belowFloor ? 'Below floor' : 'Healthy'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Score formula</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    35% global + 25% category floor + 20% evidence + 10% source IDs + 10% dispute health.
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Component scores</p>
                  <dl className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Global</dt>
                      <dd className="tabular-nums">{fmtPctPrecise(data.live.completeness.components.global)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Category floor</dt>
                      <dd className="tabular-nums">{fmtPctPrecise(data.live.completeness.components.categoryFloor)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Evidence</dt>
                      <dd className="tabular-nums">{fmtPctPrecise(data.live.completeness.components.evidence)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Source IDs</dt>
                      <dd className="tabular-nums">{fmtPctPrecise(data.live.completeness.components.sourceId)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Dispute health</dt>
                      <dd className="tabular-nums">{fmtPctPrecise(data.live.completeness.components.disputeHealth)}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Below-floor categories</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {data.live.completeness.gate.categoriesBelowFloor.length > 0
                      ? data.live.completeness.gate.categoriesBelowFloor.join(', ')
                      : 'None'}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SlaTargetsPanel />

          <ImageHealthPanel />

          <CuratorQueuePanel />

          <SectionCard
            title="Source-ID Health"
            subtitle="DQ.34 coverage of valid upstream source IDs across TMDb, AniList, IGDB, ComicVine, and Wikidata."
          >
            {sourceHealthStatus ? (
              <div className="mb-4 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {sourceHealthStatus.report ? (
                  <>
                    Latest materialized report: {relativeFromIso(sourceHealthStatus.report.generatedAt)}
                    {' · '}
                    {sourceHealthStatus.report.totals.validCharacters.toLocaleString()} / {sourceHealthStatus.report.totals.totalCharacters.toLocaleString()} valid
                    {' · '}
                    {sourceHealthStatus.report.totals.issueCount.toLocaleString()} issues
                  </>
                ) : (
                  'No persisted source-health report found in KV yet.'
                )}
              </div>
            ) : null}

            {sourceHealth ? (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Kpi
                    label="Coverage"
                    value={fmtPctPrecise(sourceHealth.totals.coveragePct)}
                    hint={`${sourceHealth.totals.validCharacters.toLocaleString()} / ${sourceHealth.totals.totalCharacters.toLocaleString()} valid source IDs`}
                  />
                  <Kpi
                    label="Issues"
                    value={sourceHealth.totals.issueCount.toLocaleString()}
                    hint="Missing, malformed, or unknown source references"
                  />
                  <Kpi
                    label="Tracked sources"
                    value={sourceHealth.perSource.length.toLocaleString()}
                    hint="Sources with individual coverage breakdowns"
                  />
                  <Kpi
                    label="Top issue source"
                    value={sourceHealth.perSource.slice().sort((a, b) => (b.missing + b.malformed) - (a.missing + a.malformed))[0]?.source ?? 'n/a'}
                    hint="Highest combined missing + malformed count"
                  />
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Coverage</th>
                        <th className="px-4 py-3 font-medium">Valid / Total</th>
                        <th className="px-4 py-3 font-medium">Missing</th>
                        <th className="px-4 py-3 font-medium">Malformed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceHealth.perSource.map((item) => (
                        <tr key={item.source} className="border-t border-border/50">
                          <td className="px-4 py-3 font-medium text-foreground">{item.source}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmtPctPrecise(item.coveragePct)}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {item.valid.toLocaleString()} / {item.total.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">{item.missing.toLocaleString()}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">{item.malformed.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Character</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Issue</th>
                        <th className="px-4 py-3 font-medium">Age (days)</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceHealth.issues.slice(0, 10).map((item) => (
                        <tr key={`${item.characterId}:${item.issueType}`} className="border-t border-border/50">
                          <td className="px-4 py-3 font-medium text-foreground">{item.characterName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.source}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.issueType}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">{item.agedDays}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Source health unavailable in this environment.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Null-Closure Queue"
            subtitle="DQ.33 prioritized missing (character, attribute) pairs for automation and manual closure."
          >
            {closureQueueStatus ? (
              <div className="mb-4 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {closureQueueStatus.report ? (
                  <>
                    Latest materialized queue: {relativeFromIso(closureQueueStatus.report.generatedAt)}
                    {' · '}
                    {closureQueueStatus.report.summary.totalPairs.toLocaleString()} queued
                    {' · '}
                    {closureQueueStatus.report.summary.automationPairs.toLocaleString()} automation
                    {' · '}
                    {closureQueueStatus.report.summary.manualPairs.toLocaleString()} manual
                  </>
                ) : (
                  'No persisted closure queue report found in KV yet.'
                )}
              </div>
            ) : null}

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Kpi
                label="Automation share (latest snapshot)"
                value={latestLaneMix ? fmtPctPrecise(latestLaneMix.automation) : 'n/a'}
                hint="Share of queued pairs routed to automation lane"
              />
              <Kpi
                label="Automation share delta"
                value={formatAutomationShareDelta(automationShareDeltaPp)}
                hint="Change versus previous snapshot"
              />
            </div>

            {closureQueue ? (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Kpi
                    label="Candidate pairs"
                    value={closureQueue.totalCandidatePairs.toLocaleString()}
                    hint="All SLA-scoped missing cells before queue cutoff"
                  />
                  <Kpi
                    label="Queued pairs"
                    value={closureQueue.summary.totalPairs.toLocaleString()}
                    hint={`Top ${closureQueue.limit} by deterministic score`}
                  />
                  <Kpi
                    label="Automation lane"
                    value={closureQueue.summary.automationPairs.toLocaleString()}
                    hint={`Score >= ${closureQueue.lanePolicy.automationScoreThreshold.toFixed(5)}`}
                  />
                  <Kpi
                    label="Manual lane"
                    value={closureQueue.summary.manualPairs.toLocaleString()}
                    hint={`Confidence gap >= ${(closureQueue.lanePolicy.automationMinConfidenceGap * 100).toFixed(0)}%`}
                  />
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Character</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Attribute</th>
                        <th className="px-4 py-3 font-medium">Lane</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closureQueue.queue.slice(0, 20).map((item) => (
                        <tr key={`${item.characterId}:${item.attributeKey}`} className="border-t border-border/50">
                          <td className="px-4 py-3 font-medium text-foreground">{item.characterName}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{item.category}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.attributeKey}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${item.lane === 'automation' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}
                            >
                              {item.lane}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">{item.score.toFixed(6)}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {fmtPctPrecise(item.components.confidenceGap)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Closure queue unavailable in this environment.
              </p>
            )}
          </SectionCard>

          <TrendChart
            title="Data health score (trend)"
            data={healthSeries}
            stroke="#7c3aed"
            yDomain={[0, 100]}
            emptyHint="No snapshots yet — run scripts/snapshot-data-quality.ts to populate."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TrendChart
              title="Golden pass rate"
              data={goldenSeries}
              stroke="#059669"
              yDomain={[0, 1]}
              yFormat={(v) => `${(v * 100).toFixed(0)}%`}
              emptyHint="No golden-set runs reported yet."
            />
            <TrendChart
              title="Vision pass rate"
              data={visionSeries}
              stroke="#2563eb"
              yDomain={[0, 1]}
              yFormat={(v) => `${(v * 100).toFixed(0)}%`}
              emptyHint="No vision-gate runs reported yet."
            />
            <TrendChart
              title="Agreement score (avg)"
              data={agreementSeries}
              stroke="#d97706"
              yDomain={[0, 1]}
              yFormat={(v) => `${(v * 100).toFixed(0)}%`}
              emptyHint="No history rows yet."
            />
            <TrendChart
              title="Open disputes"
              data={disputeSeries}
              stroke="#dc2626"
              emptyHint="No history rows yet."
            />
            <TrendChart
              title="Closure queue (total)"
              data={closureTotalSeries}
              stroke="#0f766e"
              emptyHint="No closure queue snapshots yet."
            />
            <TrendChart
              title="Closure queue (automation lane)"
              data={closureAutomationSeries}
              stroke="#16a34a"
              emptyHint="No closure queue snapshots yet."
            />
            <TrendChart
              title="Closure queue (manual lane)"
              data={closureManualSeries}
              stroke="#f59e0b"
              emptyHint="No closure queue snapshots yet."
            />
            <LaneMixChart
              title="Closure lane mix (share)"
              data={closureLaneMixSeries}
              emptyHint="No closure queue snapshots yet."
            />
          </div>
        </>
      )}
    </div>
  )
}
