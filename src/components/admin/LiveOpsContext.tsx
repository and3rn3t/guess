import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/** Mirrors LiveOpsSummary in functions/api/admin/_live_ops.ts */
export interface LiveOpsSummary {
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

export type HealthStatus = 'unknown' | 'healthy' | 'warn' | 'critical'

export interface LiveOpsContextValue {
  data: LiveOpsSummary | null
  status: HealthStatus
  error: string | null
  refreshing: boolean
  refresh: () => void
}

const REFRESH_MS = 30_000

const Ctx = createContext<LiveOpsContextValue | null>(null)

/**
 * AN.30 + AP.20 — single shared poller for the admin live-ops summary. Both
 * the LiveOpsStrip and the HealthBadge subscribe to this so the page only
 * issues one `GET /api/admin/live-ops` per 30s tick.
 */
export function LiveOpsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
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

  const value: LiveOpsContextValue = {
    data,
    status: computeStatus(data),
    error,
    refreshing,
    refresh: () => void fetchData(),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLiveOps(): LiveOpsContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Allow components to render outside the provider (tests, isolated previews)
    // by returning a stable "unknown" placeholder rather than throwing.
    return { data: null, status: 'unknown', error: null, refreshing: false, refresh: () => {} }
  }
  return ctx
}

export function computeStatus(data: LiveOpsSummary | null): HealthStatus {
  if (!data) return 'unknown'
  const rate = data.errorRate ?? 0
  if (rate > 0.05) return 'critical'
  if (rate > 0.01 || (data.warns1h ?? 0) > 0) return 'warn'
  return 'healthy'
}
