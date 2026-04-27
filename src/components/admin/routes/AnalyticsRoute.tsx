import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ArrowRightIcon, ChartBarIcon, SparkleIcon, XIcon } from '@phosphor-icons/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ClientEvent {
  id: string
  session_id: string | null
  user_id: string | null
  event_type: string
  data: string | null
  client_ts: number | null
  created_at: number
}

interface EventSummary {
  event_type: string
  count: number
}

interface PageData {
  events: ClientEvent[]
  total: number
  page: number
  pageSize: number
  summary: EventSummary[]
}

const EVENT_COLORS: Record<string, string> = {
  game_start: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  game_end: 'bg-green-500/20 text-green-400 border-green-500/30',
  share: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  guess: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const BAR_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#8b5cf6', '#0891b2']

export default function AnalyticsRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [page, setPage] = useState(1)
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const pageSize = 25

  const fetchData = async (type: string, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (type) params.set('event_type', type)
      const res = await fetch(`/api/admin/analytics?${params}`)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData(filterType, page) }, [filterType, page])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

  const fetchInsights = async (bust = false) => {
    setInsightsLoading(true)
    setShowInsights(true)
    try {
      const res = await fetch('/api/admin/analytics/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: data?.summary ?? [], bustCache: bust }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json() as { insights: string }
      setInsights(json.insights)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Insights failed')
    } finally {
      setInsightsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Client Analytics</h1>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.total.toLocaleString()} events</p>}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void fetchInsights()}
          disabled={insightsLoading || !data}
          className="text-violet-400 border-violet-500/40 hover:bg-violet-500/10"
        >
          <SparkleIcon size={14} className={`mr-1.5 ${insightsLoading ? 'animate-pulse' : ''}`} />
          {insightsLoading ? 'Thinking…' : 'AI Insights'}
        </Button>
      </div>

      {/* AI Insights Card */}
      {showInsights && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-violet-300 font-medium text-sm">
              <SparkleIcon size={14} /> AI Insights
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void fetchInsights(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Refresh
              </button>
              <button onClick={() => setShowInsights(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon size={14} />
              </button>
            </div>
          </div>
          {insightsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-violet-500/20 animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{insights}</p>
          )}
        </div>
      )}

      {/* BarChart for event type distribution */}
      {(data?.summary.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-card px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Event Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data!.summary} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="event_type" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data!.summary.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Event type filter pills */}
      {(data?.summary.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setFilterType(''); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              !filterType ? 'bg-violet-600 text-white border-violet-600' : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            All
          </button>
          {data?.summary.map((s) => (
            <button
              key={s.event_type}
              onClick={() => { setFilterType(s.event_type); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filterType === s.event_type ? 'bg-violet-600 text-white border-violet-600' : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {s.event_type}
              <span className="ml-1.5 opacity-60 text-xs">{s.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!loading && data?.total === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <ChartBarIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {filterType ? `No ${filterType} events recorded.` : 'No client events recorded yet.'}
          </p>
        </div>
      )}

      {(data?.total ?? 0) > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Event type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Session</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                : (data?.events ?? []).map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(e.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${EVENT_COLORS[e.event_type] ?? 'bg-muted text-muted-foreground border-border'}`}>
                          {e.event_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {e.session_id ? `${e.session_id.slice(0, 8)}\u2026` : '\u2014'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {e.user_id ? `${e.user_id.slice(0, 8)}\u2026` : '\u2014'}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs"
                        title={e.data ?? ''}
                      >
                        {e.data ? (e.data.length > 80 ? `${e.data.slice(0, 80)}\u2026` : e.data) : '\u2014'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>
              <ArrowLeftIcon size={14} className="mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || loading}>
              Next <ArrowRightIcon size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
