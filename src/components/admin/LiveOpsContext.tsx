import { useCallback, useEffect, useState } from 'react'
import { LiveOpsCtx, computeStatus, type LiveOpsContextValue, type LiveOpsSummary } from './liveOps'

const REFRESH_MS = 30_000

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

  return <LiveOpsCtx.Provider value={value}>{children}</LiveOpsCtx.Provider>
}
