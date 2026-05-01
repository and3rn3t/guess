import { useEffect, useState } from 'react'
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
}

interface DataQualityResponse {
  live: LiveSnapshot
  history: HistoryRow[]
  windowDays: number
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
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

function toDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

export default function DataQualityRoute(): React.JSX.Element {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/data-quality')
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return (await res.json()) as DataQualityResponse
      })
      .then((json) => {
        if (!cancelled) setData(json)
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
  const goldenSeries = history
    .filter((row) => row.golden_pass_rate !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.golden_pass_rate as number }))
  const visionSeries = history
    .filter((row) => row.vision_pass_rate !== null)
    .map((row) => ({ day: toDay(row.captured_at), value: row.vision_pass_rate as number }))
  const agreementSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.agreement_avg }))
  const disputeSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.open_disputes }))
  const healthSeries = history.map((row) => ({ day: toDay(row.captured_at), value: row.data_health_score }))

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Data Quality</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          DQ.7 · live snapshot computed on every load · trend window {data?.windowDays ?? 30} days · history written nightly by{' '}
          <code>scripts/snapshot-data-quality.ts</code>.
        </p>
      </div>

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
          </div>
        </>
      )}
    </div>
  )
}
