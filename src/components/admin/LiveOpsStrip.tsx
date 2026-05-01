import { useEffect, useState, useCallback } from 'react'
import { ActivityIcon, AlertTriangleIcon, GaugeIcon, RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Mirrors LiveOpsSummary in functions/api/admin/_live_ops.ts */
interface LiveOpsSummary {
  games1h: number
  wins1h: number
  losses1h: number
  errors1h: number
  warns1h: number
  gamesPerMin: number
  errorsPerMin: number
  winRate: number | null
  errorRate: number | null
  p95LatencyMs: number | null
  generatedAt: number
}

const REFRESH_MS = 30_000

/**
 * AN.30 — Live ops strip. Compact rolling-1h health snapshot rendered above
 * each admin route's `<Outlet />`. Polls `/api/admin/live-ops` every 30s; the
 * dot color is the at-a-glance health pixel:
 *
 *   - green  = no errors and (no games OR errorRate ≤ 1%)
 *   - amber  = errorRate ≤ 5% (or warnings only)
 *   - red    = errorRate > 5%
 */
export function LiveOpsStrip(): React.JSX.Element {
  const [data, setData] = useState<LiveOpsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/live-ops', { signal, credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as LiveOpsSummary
      setData(json)
      setError(null)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    void fetchData(ctrl.signal)
    const id = setInterval(() => void fetchData(), REFRESH_MS)
    return () => {
      ctrl.abort()
      clearInterval(id)
    }
  }, [fetchData])

  const status = computeStatus(data)

  return (
    <div className="border-b border-border/60 bg-muted/30 backdrop-blur supports-[backdrop-filter]:bg-muted/20 px-4 py-2 flex items-center gap-4 text-xs">
      <span
        className={cn('inline-flex h-2 w-2 rounded-full', dotColor(status))}
        title={`Status: ${status}`}
        aria-label={`Live ops status: ${status}`}
      />

      <Metric icon={<ActivityIcon size={12} />} label="Games/min">
        {data && typeof data.gamesPerMin === 'number' ? data.gamesPerMin.toFixed(2) : '—'}
      </Metric>

      <Metric icon={<AlertTriangleIcon size={12} />} label="Error rate">
        {formatRate(data?.errorRate)}
      </Metric>

      <Metric icon={<GaugeIcon size={12} />} label="p95">
        {formatLatency(data?.p95LatencyMs)}
      </Metric>

      {data && typeof data.games1h === 'number' ? (
        <span className="text-muted-foreground/70">
          {data.games1h} games · {data.wins1h ?? 0}W/{data.losses1h ?? 0}L · {data.errors1h ?? 0} errors (last 1h)
        </span>
      ) : null}

      {error ? (
        <span className="text-destructive ml-auto" role="alert">
          live-ops error: {error}
        </span>
      ) : (
        <span className="ml-auto text-muted-foreground/60 inline-flex items-center gap-1">
          <RefreshCwIcon size={10} className={refreshing ? 'animate-spin' : undefined} />
          {data && typeof data.generatedAt === 'number'
            ? `updated ${secondsAgo(data.generatedAt)}s ago`
            : 'loading…'}
        </span>
      )}
    </div>
  )
}

function Metric({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground/70" aria-hidden>
        {icon}
      </span>
      <span className="text-muted-foreground/70">{label}:</span>
      <span className="font-medium tabular-nums text-foreground">{children}</span>
    </span>
  )
}

type Status = 'unknown' | 'healthy' | 'warn' | 'critical'

function computeStatus(data: LiveOpsSummary | null): Status {
  if (!data) return 'unknown'
  const rate = data.errorRate ?? 0
  if (rate > 0.05) return 'critical'
  if (rate > 0.01 || (data.warns1h ?? 0) > 0) return 'warn'
  return 'healthy'
}

function dotColor(status: Status): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500'
    case 'warn':
      return 'bg-amber-500'
    case 'critical':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/40'
  }
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null) return '—'
  return `${(rate * 100).toFixed(2)}%`
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function secondsAgo(unixSeconds: number): number {
  return Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds))
}
