import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircleIcon,
  ClockIcon,
  ArrowsClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@phosphor-icons/react'

interface EnrichmentSummary {
  total: number
  enriched: number
  pending: number
  coveragePct: number
}

interface CharacterRow {
  id: string
  name: string
  category: string
  imageUrl: string | null
  enriched: boolean
  createdAt: number
}

interface PageData {
  summary: EnrichmentSummary
  characters: CharacterRow[]
  total: number
  page: number
  pageSize: number
}

type Filter = 'pending' | 'enriched' | 'all'

export default function EnrichmentRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(1)
  const [retrying, setRetrying] = useState(false)
  const [retryMsg, setRetryMsg] = useState<string | null>(null)
  const pageSize = 50

  const fetchData = async (f: Filter, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ filter: f, page: String(p), pageSize: String(pageSize) })
      const res = await fetch(`/api/admin/enrichment?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData(filter, page) }, [filter, page])

  const handleRetry = async () => {
    setRetrying(true)
    setRetryMsg(null)
    try {
      const res = await fetch('/api/admin/enrichment', { method: 'POST' })
      const body = await res.json() as { queued?: number; message?: string }
      setRetryMsg(body.message ?? `Queued ${body.queued} characters for enrichment`)
    } catch {
      setRetryMsg('Retry request failed')
    } finally {
      setRetrying(false)
    }
  }

  const summary = data?.summary
  const totalPages = data ? Math.ceil(data.total / pageSize) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Enrichment Status</h1>
          <p className="text-sm text-muted-foreground mt-1">Image enrichment pipeline coverage</p>
        </div>
        <Button onClick={() => void handleRetry()} disabled={retrying || (summary?.pending === 0)} variant="outline" size="sm">
          <ArrowsClockwiseIcon size={16} className={`mr-2 ${retrying ? 'animate-spin' : ''}`} />
          Retry pending
        </Button>
      </div>

      {retryMsg && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-sm text-blue-400">{retryMsg}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Enriched', value: summary?.enriched, icon: <CheckCircleIcon size={20} className="text-green-500" />, color: 'text-green-500' },
          { label: 'Pending', value: summary?.pending, icon: <ClockIcon size={20} className="text-yellow-500" />, color: 'text-yellow-500' },
          { label: 'Coverage', value: summary ? `${summary.coveragePct}%` : undefined, icon: null, color: 'text-violet-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl border bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon}{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'enriched', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Character</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Category</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={3} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td></tr>
                ))
              : (data?.characters ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.imageUrl
                          ? <img src={c.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" loading="lazy" />
                          : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs">{c.name[0]}</div>
                        }
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.category}</td>
                    <td className="px-4 py-3 text-center">
                      {c.enriched
                        ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">enriched</Badge>
                        : <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs">pending</Badge>
                      }
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

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
