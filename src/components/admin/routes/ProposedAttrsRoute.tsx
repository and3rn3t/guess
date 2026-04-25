import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusCircleIcon,
} from '@phosphor-icons/react'

interface Proposal {
  id: number
  key: string
  display_text: string
  question_text: string
  rationale: string | null
  example_chars: string | null
  proposed_by: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: number
}

interface PageData {
  proposals: Proposal[]
  total: number
  page: number
  pageSize: number
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function ProposedAttrsRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(1)
  const [acting, setActing] = useState<number | null>(null)
  const pageSize = 25

  const fetchData = async (f: Filter, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status: f, page: String(p), pageSize: String(pageSize) })
      const res = await fetch(`/api/admin/proposed-attributes?${params}`)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData(filter, page) }, [filter, page])

  const action = async (id: number, act: 'approve' | 'reject') => {
    setActing(id)
    try {
      let res: Response
      if (act === 'approve') {
        // Use the /[id] route which actually inserts into attribute_definitions
        res = await fetch(`/api/admin/proposed-attributes/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        })
      } else {
        res = await fetch('/api/admin/proposed-attributes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'rejected' }),
        })
      }
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `${res.status}`)
      }
      await fetchData(filter, page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proposed Attributes</h1>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.total} proposals</p>}
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {data?.total === 0 && !loading && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <PlusCircleIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {filter === 'pending'
              ? 'No pending attribute proposals. LLM-generated proposals will appear here after an enrichment run.'
              : `No ${filter} proposals.`}
          </p>
        </div>
      )}

      {(data?.total ?? 0) > 0 && (
        <div className="space-y-3">
          {(data?.proposals ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{p.key}</code>
                    <Badge className={`text-xs ${STATUS_STYLES[p.status] ?? ''}`}>{p.status}</Badge>
                    <span className="text-xs text-muted-foreground">by {p.proposed_by} · {formatDate(p.created_at)}</span>
                  </div>
                  <p className="font-medium">{p.display_text}</p>
                  <p className="text-sm text-muted-foreground italic">"{p.question_text}"</p>
                  {p.rationale && (
                    <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 mt-2">{p.rationale}</p>
                  )}
                  {p.example_chars && (() => {
                    try {
                      const chars = JSON.parse(p.example_chars) as { name: string }[]
                      return (
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          <span className="text-xs text-muted-foreground">Examples:</span>
                          {chars.map((c, i) => <Badge key={i} variant="outline" className="text-xs">{c.name}</Badge>)}
                        </div>
                      )
                    } catch { return null }
                  })()}
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-400 border-green-500/40 hover:bg-green-500/10"
                      disabled={acting === p.id}
                      onClick={() => void action(p.id, 'approve')}
                    >
                      <CheckCircleIcon size={14} className="mr-1.5" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-500/40 hover:bg-red-500/10"
                      disabled={acting === p.id}
                      onClick={() => void action(p.id, 'reject')}
                    >
                      <XCircleIcon size={14} className="mr-1.5" />Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>
              <ArrowLeftIcon size={14} className="mr-1" />Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || loading}>
              Next<ArrowRightIcon size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
