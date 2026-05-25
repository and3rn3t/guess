import { useEffect, useState } from 'react'

import type {
  ClosureQueueResponse,
  ClosureQueueStatusResponse,
  DataQualityResponse,
  SourceHealthResponse,
  SourceHealthStatusResponse,
} from './dataQualityTypes'

export interface DataQualitySnapshotState {
  data: DataQualityResponse | null
  closureQueue: ClosureQueueResponse | null
  closureQueueStatus: ClosureQueueStatusResponse | null
  sourceHealth: SourceHealthResponse | null
  sourceHealthStatus: SourceHealthStatusResponse | null
  loading: boolean
  error: string | null
}

export function useDataQualitySnapshot(): DataQualitySnapshotState {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [closureQueue, setClosureQueue] = useState<ClosureQueueResponse | null>(null)
  const [closureQueueStatus, setClosureQueueStatus] = useState<ClosureQueueStatusResponse | null>(null)
  const [sourceHealth, setSourceHealth] = useState<SourceHealthResponse | null>(null)
  const [sourceHealthStatus, setSourceHealthStatus] = useState<SourceHealthStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/admin/data-quality').then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return (await res.json()) as DataQualityResponse
      }),
      fetch('/api/admin/data-quality/closure-queue?limit=50')
        .then(async (res) => (res.ok ? ((await res.json()) as ClosureQueueResponse) : null))
        .catch(() => null),
      fetch('/api/admin/data-quality/closure-queue-status')
        .then(async (res) => (res.ok ? ((await res.json()) as ClosureQueueStatusResponse) : null))
        .catch(() => null),
      fetch('/api/admin/source-health?limit=20')
        .then(async (res) => (res.ok ? ((await res.json()) as SourceHealthResponse) : null))
        .catch(() => null),
      fetch('/api/admin/source-health-status')
        .then(async (res) => (res.ok ? ((await res.json()) as SourceHealthStatusResponse) : null))
        .catch(() => null),
    ])
      .then(([snapshot, closure, closureStatus, sourceHealthResponse, sourceHealthStatusResponse]) => {
        if (!cancelled) {
          setData(snapshot)
          setClosureQueue(closure)
          setClosureQueueStatus(closureStatus)
          setSourceHealth(sourceHealthResponse)
          setSourceHealthStatus(sourceHealthStatusResponse)
        }
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

  return { data, closureQueue, closureQueueStatus, sourceHealth, sourceHealthStatus, loading, error }
}
