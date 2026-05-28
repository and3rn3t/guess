import { Fragment, useEffect, useState } from 'react'
import { AdminPageHeader } from '../AdminPageHeader'
import { FreshnessPill } from '../FreshnessPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeftIcon, ArrowRightIcon, ChartBarIcon, LightningIcon, MagnifyingGlassIcon, SparkleIcon, XIcon, UsersIcon, ClockCounterClockwiseIcon } from '@phosphor-icons/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { httpClient } from '@/lib/http'
import type { paths } from '@/lib/api.generated'

type PageData =
  paths['/api/admin/analytics']['get']['responses']['200']['content']['application/json']
type AhaMomentsResponse =
  paths['/api/admin/analytics/aha-moments']['get']['responses']['200']['content']['application/json']
type AhaMomentSummary = AhaMomentsResponse['moments'][number]
type InsightsRequest =
  paths['/api/admin/analytics/insights']['post']['requestBody']['content']['application/json']
type InsightsResponse =
  paths['/api/admin/analytics/insights']['post']['responses']['200']['content']['application/json']

interface AnalyticsPreset {
  id: string
  label: string
  eventType: string
  query: string
  days: string
}

const EVENT_COLORS: Record<string, string> = {
  game_start: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  game_end: 'bg-green-500/20 text-green-400 border-green-500/30',
  share: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  guess: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const BAR_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#8b5cf6', '#0891b2']
const LOADING_ROW_KEYS = ['s1', 's2', 's3', 's4', 's5']
const CUSTOM_PRESETS_KEY = 'admin.analytics.customPresets.v1'

const BUILTIN_PRESETS: AnalyticsPreset[] = [
  { id: 'funnel', label: 'Funnel Health (7d)', eventType: 'game_end', query: '', days: '7' },
  { id: 'shares', label: 'Sharing Activity (30d)', eventType: 'share', query: '', days: '30' },
  { id: 'guess-quality', label: 'Guess Quality (30d)', eventType: 'guess', query: '', days: '30' },
]

function payloadPreview(payload: string | null): string {
  if (!payload) return '--'
  if (payload.length <= 80) return payload
  return `${payload.slice(0, 80)}...`
}

function parseCustomPresets(raw: string | null): AnalyticsPreset[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is AnalyticsPreset => {
        if (typeof item !== 'object' || item === null) return false
        const candidate = item as Record<string, unknown>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.label === 'string' &&
          typeof candidate.eventType === 'string' &&
          typeof candidate.query === 'string' &&
          typeof candidate.days === 'string'
        )
      })
      .slice(0, 8)
  } catch {
    return []
  }
}

export default function AnalyticsRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [query, setQuery] = useState('')
  const [days, setDays] = useState('30')
  const [page, setPage] = useState(1)
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [ahaMoments, setAhaMoments] = useState<AhaMomentSummary[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [customPresets, setCustomPresets] = useState<AnalyticsPreset[]>([])
  const pageSize = 25

  const applyPreset = (preset: AnalyticsPreset) => {
    setFilterType(preset.eventType)
    setQuery(preset.query)
    setDays(preset.days)
    setPage(1)
  }

  const saveCurrentPreset = () => {
    const label = globalThis.prompt('Preset name')?.trim()
    if (!label) return

    const nextPreset: AnalyticsPreset = {
      id: `custom-${Date.now()}`,
      label,
      eventType: filterType,
      query,
      days,
    }

    setCustomPresets((prev) => [nextPreset, ...prev].slice(0, 8))
  }

  const fetchData = async (type: string, p: number, q: string, d: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (type) params.set('event_type', type)
      if (q.trim()) params.set('q', q.trim())
      params.set('days', d)
      const json = await httpClient.getJson<PageData>(`/api/admin/analytics?${params}`)
      setData(json)
      setLastFetchedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(CUSTOM_PRESETS_KEY)
    setCustomPresets(parseCustomPresets(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets))
  }, [customPresets])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      void fetchData(filterType, 1, query, days)
    }, 250)
    return () => clearTimeout(timer)
  }, [filterType, query, days])

  useEffect(() => { void fetchData(filterType, page, query, days) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps -- explicit args are passed and debounce effect above handles filter/query updates

  useEffect(() => {
    void httpClient
      .getJson<AhaMomentsResponse>('/api/admin/analytics/aha-moments')
      .then((json) => {
        if (Array.isArray(json.moments)) {
          setAhaMoments(json.moments)
        }
      })
      .catch(() => { /* non-critical */ })
  }, [])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

  const fetchInsights = async (bust = false) => {
    setInsightsLoading(true)
    setShowInsights(true)
    try {
      const body: InsightsRequest = {
        summary: data?.summary ?? [],
        totalGames7d: data?.total ?? 0,
        bustCache: bust,
      }
      const json = await httpClient.postJson<InsightsResponse>(
        '/api/admin/analytics/insights',
        body,
      )
      setInsights(json.insights)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Insights failed')
    } finally {
      setInsightsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Client Analytics"
        subtitle={data ? `${data.total.toLocaleString()} events` : undefined}
        sectionColor="violet"
        actions={
          <>
            <FreshnessPill
              fetchedAt={lastFetchedAt}
              onRefresh={() => void fetchData(filterType, page, query, days)}
              refreshing={loading}
            />
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
          </>
        }
      />

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
              <button
                type="button"
                onClick={() => setShowInsights(false)}
                aria-label="Close insights"
                title="Close insights"
                className="text-muted-foreground hover:text-foreground"
              >
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

      {(data?.total ?? 0) > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Events</div>
            <div className="text-xl font-semibold text-foreground">{data?.total.toLocaleString() ?? '0'}</div>
            <div className="text-xs text-muted-foreground">Last {days} days</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Sessions</div>
            <div className="text-xl font-semibold text-blue-400">{(data?.aggregates.uniqueSessions ?? 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Unique session IDs</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Users</div>
            <div className="text-xl font-semibold text-violet-400">{(data?.aggregates.uniqueUsers ?? 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Unique user IDs</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Top Event</div>
            <div className="text-base font-semibold text-emerald-400">{data?.summary[0]?.event_type ?? 'n/a'}</div>
            <div className="text-xs text-muted-foreground">{(data?.summary[0]?.count ?? 0).toLocaleString()} occurrences</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search event payload, session, user"
              className="pl-9"
            />
          </div>
          <select
            value={days}
            onChange={(event) => setDays(event.target.value)}
            aria-label="Time window"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="1">Last 24h</option>
            <option value="7">Last 7d</option>
            <option value="30">Last 30d</option>
            <option value="90">Last 90d</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery('')
              setFilterType('')
              setDays('30')
              setPage(1)
            }}
          >
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={saveCurrentPreset}>
            Save preset
          </Button>
          {customPresets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomPresets([])}
              className="text-muted-foreground"
            >
              Clear saved
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
            <UsersIcon size={12} />
            {(data?.aggregates.uniqueUsers ?? 0).toLocaleString()} users
            <ClockCounterClockwiseIcon size={12} className="ml-2" />
            {days}d window
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Filter Presets</div>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_PRESETS.map((preset) => (
            <Button key={preset.id} size="sm" variant="outline" onClick={() => applyPreset(preset)}>
              {preset.label}
            </Button>
          ))}
          {customPresets.map((preset) => (
            <Button key={preset.id} size="sm" variant="secondary" onClick={() => applyPreset(preset)}>
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Aha Moments Card (AN.11) */}
      {ahaMoments.length > 0 && (
        <div className="rounded-xl border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <LightningIcon size={14} className="text-amber-400" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Breakthrough Attributes — last 30 days
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Attribute</th>
                  <th className="pb-2 font-medium text-right">Games</th>
                  <th className="pb-2 font-medium text-right">Median jump</th>
                  <th className="pb-2 font-medium text-right">Avg jump</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ahaMoments.slice(0, 10).map((m) => (
                  <tr key={m.attribute} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 font-mono text-xs">{m.attribute}</td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{m.count}</td>
                    <td className="py-2 text-right text-xs text-amber-400">{(m.medianJump * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{(m.avgJump * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={BAR_COLORS[0]} />
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
              filterType === '' ? 'bg-violet-600 text-white border-violet-600' : 'bg-card text-muted-foreground border-border hover:text-foreground'
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

      {(data?.events.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data
                ? LOADING_ROW_KEYS.map((rowKey) => (
                    <tr key={rowKey}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                : (data?.events ?? []).map((e) => (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedEventId((prev) => prev === e.id ? null : e.id)}>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(e.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${EVENT_COLORS[e.event_type] ?? 'bg-muted text-muted-foreground border-border'}`}>
                            {e.event_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {e.session_id ? `${e.session_id.slice(0, 8)}...` : '--'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {e.user_id ? `${e.user_id.slice(0, 8)}...` : '--'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs" title={e.data ?? ''}>
                          {payloadPreview(e.data)}
                        </td>
                      </tr>
                      {expandedEventId === e.id && (
                        <tr className="bg-muted/20">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="rounded border border-border bg-background p-2">
                                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Metadata</div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <div>id: <span className="font-mono">{e.id}</span></div>
                                  <div>session: <span className="font-mono">{e.session_id ?? '--'}</span></div>
                                  <div>user: <span className="font-mono">{e.user_id ?? '--'}</span></div>
                                  <div>client ts: <span className="font-mono">{e.client_ts ?? '--'}</span></div>
                                </div>
                              </div>
                              <div className="rounded border border-border bg-background p-2">
                                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Payload</div>
                                <pre className="text-xs whitespace-pre-wrap wrap-break-word text-foreground max-h-40 overflow-auto">{e.data ?? '--'}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
