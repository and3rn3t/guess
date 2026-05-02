import { createContext, useContext } from 'react'

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
  telemetryErrors1h: number | null
  loggingGap: boolean | null
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

export const LiveOpsCtx = createContext<LiveOpsContextValue | null>(null)

export function useLiveOps(): LiveOpsContextValue {
  const ctx = useContext(LiveOpsCtx)
  if (!ctx) {
    // Allow components to render outside the provider (tests, isolated previews)
    // by returning a stable "unknown" placeholder rather than throwing.
    return { data: null, status: 'unknown', error: null, refreshing: false, refresh: () => {} }
  }
  return ctx
}

export function computeStatus(data: LiveOpsSummary | null): HealthStatus {
  if (!data) return 'unknown'
  if (data.loggingGap) return 'critical'
  const rate = data.errorRate ?? 0
  if (rate > 0.05) return 'critical'
  if (rate > 0.01 || (data.warns1h ?? 0) > 0) return 'warn'
  return 'healthy'
}
