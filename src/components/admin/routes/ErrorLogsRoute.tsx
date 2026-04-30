import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, ArrowRightIcon, ArrowsClockwiseIcon, TrashIcon, CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react'

interface ErrorLog {
  id: number
  level: 'error' | 'warn'
  source: string
  message: string
  detail: string | null
  created_at: number
}

interface ErrorDetail {
  message?: string
  stack?: string
}

interface ResolvedFrame {
  raw: string
  resolved: { source: string; line: number; column: number; name: string | null } | null
  reason?: string
}

interface PageData {
  logs: ErrorLog[]
  total: number
  page: number
  pageSize: number
  sources: string[]
}

const LEVEL_STYLES: Record<string, string> = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warn:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

function ResolvedStack({ frames, sha }: { frames: ResolvedFrame[]; sha: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Resolved against sha <span className="font-mono">{sha.slice(0, 7)}</span>
      </p>
      <pre className="whitespace-pre-wrap text-[11px] text-foreground/90">
        {frames
          .map((f) =>
            f.resolved
              ? `  at ${f.resolved.name ?? '<anon>'} (${f.resolved.source}:${f.resolved.line}:${f.resolved.column})`
              : `  at ${f.raw}  ⟶ ${f.reason ?? 'unresolved'}`,
          )
          .join('\n')}
      </pre>
    </div>
  )
}

function DetailRow({ detail }: { detail: string }) {
  let parsed: ErrorDetail | null = null
  try {
    parsed = JSON.parse(detail) as ErrorDetail
  } catch {
    /* raw string fallback */
  }

  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState<{ frames: ResolvedFrame[]; sha: string } | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const stack = parsed?.stack ?? null
  const canResolve = Boolean(stack && /\/assets\/[\w.-]+\.js:\d+:\d+/.test(stack))

  const onResolve = async () => {
    if (!stack) return
    setResolving(true)
    setResolveError(null)
    try {
      const res = await fetch('/api/admin/resolve-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stack }),
      })
      const body = (await res.json()) as { sha?: string; frames?: ResolvedFrame[]; error?: string }
      if (!res.ok) throw new Error(body.error ?? `${res.status}`)
      setResolved({ sha: body.sha ?? '', frames: body.frames ?? [] })
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Resolve failed')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="font-mono text-xs text-muted-foreground bg-muted/40 rounded p-3 space-y-2 max-h-72 overflow-auto">
      {parsed ? (
        <>
          {parsed.message && <p className="text-foreground">{parsed.message}</p>}
          {parsed.stack && (
            <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground/80 mt-1">
              {parsed.stack}
            </pre>
          )}
          {canResolve && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => void onResolve()}
                disabled={resolving}
              >
                {resolving ? 'Resolving…' : resolved ? 'Re-resolve' : 'Resolve stack'}
              </Button>
              {resolveError && <span className="text-[11px] text-red-400">{resolveError}</span>}
            </div>
          )}
          {resolved && <ResolvedStack frames={resolved.frames} sha={resolved.sha} />}
        </>
      ) : (
        <pre className="whitespace-pre-wrap">{detail}</pre>
      )}
    </div>
  )
}

function LogRow({ log }: { log: ErrorLog }) {
  const [expanded, setExpanded] = useState(false)

  const formattedDate = new Date(log.created_at).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
  })

  return (
    <>
      <tr
        className={`hover:bg-muted/30 transition-colors ${log.detail ? 'cursor-pointer' : ''}`}
        onClick={() => log.detail && setExpanded((e) => !e)}
      >
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formattedDate}</td>
        <td className="px-4 py-3">
          <Badge className={`text-xs ${LEVEL_STYLES[log.level] ?? ''}`}>{log.level}</Badge>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className="text-xs font-mono">{log.source}</Badge>
        </td>
        <td className="px-4 py-3 text-sm max-w-sm">
          <span className="flex items-start gap-1.5">
            {log.detail && (
              <span className="mt-0.5 shrink-0 text-muted-foreground">
                {expanded ? <CaretDownIcon size={12} /> : <CaretRightIcon size={12} />}
              </span>
            )}
            {log.message}
          </span>
        </td>
      </tr>
      {expanded && log.detail && (
        <tr className="bg-muted/20">
          <td colSpan={4} className="px-6 pb-3 pt-0">
            <DetailRow detail={log.detail} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function ErrorLogsRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [page, setPage] = useState(1)
  const [clearing, setClearing] = useState(false)
  const pageSize = 50

  const fetchData = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (filterLevel) params.set('level', filterLevel)
      if (filterSource) params.set('source', filterSource)
      const res = await fetch(`/api/admin/error-logs?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setData(await res.json() as PageData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filterLevel, filterSource])

  useEffect(() => { setPage(1); void fetchData(1) }, [filterLevel, filterSource, fetchData])
  useEffect(() => { void fetchData(page) }, [page, fetchData])

  const clearAll = async () => {
    if (!confirm('Delete all error logs?')) return
    setClearing(true)
    try {
      const res = await fetch('/api/admin/error-logs', { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchData(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setClearing(false)
    }
  }

  const clearOld = async () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    setClearing(true)
    try {
      const res = await fetch(`/api/admin/error-logs?before=${sevenDaysAgo}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchData(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setClearing(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Error Logs</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.total} entr{data.total === 1 ? 'y' : 'ies'} — capped at 1 000 rows
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Level filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All levels</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
          </select>

          {/* Source filter (dynamic) */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All sources</option>
            {(data?.sources ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData(page)}
            disabled={loading}
          >
            <ArrowsClockwiseIcon size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void clearOld()}
            disabled={clearing || loading}
          >
            <TrashIcon size={14} />
            Clear &gt;7d
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => void clearAll()}
            disabled={clearing || loading}
          >
            <TrashIcon size={14} />
            Clear all
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && data?.total === 0 && (
        <div className="rounded-xl border bg-card px-6 py-14 text-center text-muted-foreground text-sm">
          No errors logged yet. Errors from Worker endpoints appear here automatically.
        </div>
      )}

      {(loading || (data?.total ?? 0) > 0) && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-44">Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Level</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                : (data?.logs ?? []).map((log) => <LogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ArrowLeftIcon size={14} />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
              <ArrowRightIcon size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
