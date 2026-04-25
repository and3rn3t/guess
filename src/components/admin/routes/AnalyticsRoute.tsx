import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ArrowRightIcon, ChartBarIcon } from '@phosphor-icons/react'

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

export default function AnalyticsRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [page, setPage] = useState(1)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Client Analytics</h1>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.total.toLocaleString()} events</p>}
        </div>
      </div>

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
