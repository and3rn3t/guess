import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

interface DailyRow {
  day: string
  starts: number
  ends: number
  abandons: number
  skips: number
}

interface SkipLeaderRow {
  question_id: string
  text: string | null
  skips: number
  avg_questions_asked: number | null
}

interface FunnelData {
  windowDays: number
  totals: {
    gameStarts: number
    gameEnds: number
    gameAbandons: number
    questionSkips: number
    completionRate: number
    abandonRate: number
    avgSkipsPerGame: number
  }
  daily: DailyRow[]
  skipLeaderboard: SkipLeaderRow[]
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

export default function FunnelRoute(): React.JSX.Element {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/funnel')
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return (await res.json()) as FunnelData
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

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Skip & Abandon Funnel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last {data?.windowDays ?? 30} days · derived from <code>client_events</code>.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load funnel: {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="md:col-span-3 h-80 w-full" />
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi
              label="Completion rate"
              value={`${(data.totals.completionRate * 100).toFixed(1)}%`}
              hint={`${data.totals.gameEnds.toLocaleString()} / ${data.totals.gameStarts.toLocaleString()} starts`}
            />
            <Kpi
              label="Abandon rate"
              value={`${(data.totals.abandonRate * 100).toFixed(1)}%`}
              hint={`${data.totals.gameAbandons.toLocaleString()} explicit quits`}
            />
            <Kpi
              label="Avg skips / game"
              value={data.totals.avgSkipsPerGame.toFixed(2)}
              hint={`${data.totals.questionSkips.toLocaleString()} total skips`}
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Daily activity</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="starts" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ends" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="abandons" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="skips" stroke="#d97706" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Top skipped questions</h2>
            {data.skipLeaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skips recorded in this window.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.skipLeaderboard} layout="vertical" margin={{ left: 24, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey={(row: SkipLeaderRow) =>
                        (row.text ?? row.question_id).slice(0, 60)
                      }
                      tick={{ fontSize: 11 }}
                      width={260}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="skips" fill="#d97706" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
