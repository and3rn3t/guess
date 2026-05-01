import { useEffect, useMemo, useState } from 'react'
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

interface PerQuestionRow {
  questionId: string
  text: string | null
  shown: number
  skipped: number
  yes: number
  no: number
  maybe: number
  unknown: number
  skipRate: number
  maybeRate: number
  frustrationScore: number
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
  perQuestion: PerQuestionRow[]
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

          <PerQuestionTable rows={data.perQuestion} />
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-question frustration table (AN.1)
// ──────────────────────────────────────────────────────────────────────────────

type SortKey =
  | 'frustrationScore'
  | 'skipRate'
  | 'maybeRate'
  | 'shown'
  | 'skipped'
  | 'text'

interface PerQuestionTableProps {
  rows: readonly PerQuestionRow[]
}

function PerQuestionTable({ rows }: Readonly<PerQuestionTableProps>): React.JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('frustrationScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const copy = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      if (sortKey === 'text') {
        const at = (a.text ?? a.questionId).toLowerCase()
        const bt = (b.text ?? b.questionId).toLowerCase()
        if (at < bt) return -dir
        if (at > bt) return dir
        return 0
      }
      const av = a[sortKey]
      const bv = b[sortKey]
      return (Number(av) - Number(bv)) * dir
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'text' ? 'asc' : 'desc')
    }
  }

  function arrow(key: SortKey): string {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4" data-testid="per-question-table">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Per-question frustration funnel</h2>
        <p className="text-xs text-muted-foreground">
          Questions shown ≥ 5 times. Frustration = 0.6 × skip rate + 0.4 × maybe rate.
        </p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No questions have crossed the 5-impression threshold in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground/70">
                <SortableTh
                  label="Question"
                  active={sortKey === 'text'}
                  onClick={() => toggleSort('text')}
                  arrow={arrow('text')}
                  align="left"
                />
                <SortableTh
                  label="Shown"
                  active={sortKey === 'shown'}
                  onClick={() => toggleSort('shown')}
                  arrow={arrow('shown')}
                />
                <SortableTh
                  label="Skipped"
                  active={sortKey === 'skipped'}
                  onClick={() => toggleSort('skipped')}
                  arrow={arrow('skipped')}
                />
                <SortableTh
                  label="Skip rate"
                  active={sortKey === 'skipRate'}
                  onClick={() => toggleSort('skipRate')}
                  arrow={arrow('skipRate')}
                />
                <SortableTh
                  label="Maybe rate"
                  active={sortKey === 'maybeRate'}
                  onClick={() => toggleSort('maybeRate')}
                  arrow={arrow('maybeRate')}
                />
                <SortableTh
                  label="Frustration"
                  active={sortKey === 'frustrationScore'}
                  onClick={() => toggleSort('frustrationScore')}
                  arrow={arrow('frustrationScore')}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.questionId}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-2 py-2 text-left">
                    <div className="font-medium">{row.text ?? row.questionId}</div>
                    <div className="text-xs text-muted-foreground">{row.questionId}</div>
                  </td>
                  <td className="px-2 py-2 text-right">{row.shown.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{row.skipped.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{(row.skipRate * 100).toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right">{(row.maybeRate * 100).toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right font-semibold">
                    <FrustrationBadge score={row.frustrationScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortableTh({
  label,
  active,
  onClick,
  arrow,
  align = 'right',
}: Readonly<{
  label: string
  active: boolean
  onClick: () => void
  arrow: string
  align?: 'left' | 'right'
}>): React.JSX.Element {
  let ariaSort: 'ascending' | 'descending' | 'none' = 'none'
  if (active) {
    ariaSort = arrow.includes('▲') ? 'ascending' : 'descending'
  }
  let ariaProps: { 'aria-sort': 'ascending' | 'descending' | 'none' } = { 'aria-sort': 'none' }
  if (ariaSort === 'ascending') ariaProps = { 'aria-sort': 'ascending' }
  else if (ariaSort === 'descending') ariaProps = { 'aria-sort': 'descending' }
  return (
    <th
      className={`cursor-pointer select-none px-2 py-2 ${align === 'right' ? 'text-right' : 'text-left'} ${active ? 'text-foreground' : ''}`}
      onClick={onClick}
      {...ariaProps}
    >
      {label}
      <span aria-hidden="true">{arrow}</span>
    </th>
  )
}

function FrustrationBadge({ score }: Readonly<{ score: number }>): React.JSX.Element {
  // Visual cue: red ≥ 0.4, amber ≥ 0.2, else neutral.
  let cls = 'text-muted-foreground'
  if (score >= 0.4) cls = 'text-red-500'
  else if (score >= 0.2) cls = 'text-amber-500'
  return <span className={cls}>{(score * 100).toFixed(1)}%</span>
}
