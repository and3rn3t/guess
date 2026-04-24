import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'

interface PipelineRun {
  id: number
  runBatch: string
  characterId: string
  step: string
  status: string
  error: string | null
  durationMs: number | null
  createdAt: number
}

interface PageData {
  runs: PipelineRun[]
  total: number
  page: number
  pageSize: number
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const STEPS = ['fetch', 'dedup', 'enrich', 'image', 'upload']
const STATUSES = ['pending', 'running', 'success', 'error']

export default function PipelineRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStep, setFilterStep] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const fetchData = async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (filterStep) params.set('step', filterStep)
      if (filterStatus) params.set('status', filterStatus)
      const res = await fetch(`/api/admin/pipeline?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); void fetchData(1) }, [filterStep, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchData(page) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Audit Log</h1>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.total} pipeline run entries</p>}
        </div>
        <div className="flex gap-2">
          <select
            value={filterStep}
            onChange={(e) => setFilterStep(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All steps</option>
            {STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {data?.total === 0 && !loading && (
        <div className="rounded-xl border bg-card px-6 py-10 text-center text-muted-foreground text-sm">
          No pipeline runs logged yet. Pipeline entries are written by the enrichment CLI scripts.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {(data?.total ?? 0) > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Batch</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Character ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Step</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-24">Duration</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-36">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td></tr>
                  ))
                : (data?.runs ?? []).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.runBatch.slice(0, 8)}…</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.characterId}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-mono">{r.step}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${STATUS_STYLES[r.status] ?? ''}`}>{r.status}</Badge>
                        {r.error && <p className="text-xs text-destructive mt-1 max-w-xs truncate" title={r.error}>{r.error}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {r.durationMs !== null ? `${r.durationMs}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
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
