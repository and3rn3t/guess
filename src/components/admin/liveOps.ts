import { createContext, useContext } from 'react'
import type { paths } from '@/lib/api.generated'

/** Derived from OpenAPI schema for GET /api/admin/live-ops. */
export type LiveOpsSummary =
  paths['/api/admin/live-ops']['get']['responses']['200']['content']['application/json']

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
