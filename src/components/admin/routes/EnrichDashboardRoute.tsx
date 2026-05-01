import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayIcon, StopIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react'

interface PipelineRun {
  id: number
  run_batch: string
  character_id: string
  character_name: string | null
  step: string
  status: string
  error: string | null
  duration_ms: number | null
  created_at: number
}

interface StreamPayload {
  runs: PipelineRun[]
  jobActive: boolean
  pendingCount: number
  lastBatchStats: {
    batchId: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    characters: number
    runAt: string
    status: 'success' | 'error'
  } | null
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

export default function EnrichDashboardRoute(): React.JSX.Element {
  const [data, setData] = useState<StreamPayload | null>(null)
  const [connected, setConnected] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [limit, setLimit] = useState(5)
  const esRef = useRef<EventSource | null>(null)
  const wasActiveRef = useRef(false)

  const connect = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    const es = new EventSource('/api/admin/enrich/stream')
    esRef.current = es
    setConnected(true)

    const handler = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as StreamPayload
        if (payload.jobActive) wasActiveRef.current = true
        setData(payload)
      } catch { /* ignore */ }
    }
    es.addEventListener('snapshot', handler)
    es.addEventListener('update', handler)
    es.addEventListener('error', (e: MessageEvent) => {
      try { setActionMsg((JSON.parse(e.data) as { message: string }).message) } catch { /* ignore */ }
    })
    es.addEventListener('done', () => {
      setConnected(false)
      // Auto-reconnect if a job was active when the 90s stream window closed
      if (wasActiveRef.current) {
        wasActiveRef.current = false
        connect()
      }
    })
    es.onerror = () => setConnected(false)
  }

  useEffect(() => {
    connect()
    return () => { esRef.current?.close() }
  }, []) // connect is intentionally stable — defined outside effect

  const sendSignal = async (action: 'start' | 'stop') => {
    setActionMsg(null)
    try {
      const res = await fetch('/api/admin/enrich/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'start' ? { action, limit } : { action }),
      })
      const body = await res.json() as { message?: string }
      setActionMsg(body.message ?? 'Done')
    } catch {
      setActionMsg('Request failed')
    }
  }

  const runs = data?.runs ?? []
  const jobActive = data?.jobActive ?? false
  const successCount = runs.filter((r) => r.status === 'success').length
  const errorCount = runs.filter((r) => r.status === 'error').length
  const runningCount = runs.filter((r) => r.status === 'running').length

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Enrichment Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            {connected
              ? <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Streaming live</span>
              : <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted" />Disconnected</span>
            }
          </p>
        </div>
        <div className="flex gap-2">
          {!connected && (
            <Button variant="outline" size="sm" onClick={connect}>
              <ArrowsClockwiseIcon size={14} className="mr-2" />Reconnect
            </Button>
          )}
          {jobActive
            ? <Button variant="outline" size="sm" onClick={() => void sendSignal('stop')} className="text-red-400 border-red-500/40">
                <StopIcon size={14} className="mr-2" />Stop
              </Button>
            : <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap" htmlFor="enrich-limit">Batch size</label>
                <input
                  id="enrich-limit"
                  type="number"
                  min={1}
                  max={10}
                  value={limit}
                  onChange={(e) => setLimit(Math.min(10, Math.max(1, Number(e.target.value))))}
                  className="w-14 rounded-md border bg-background px-2 py-1 text-sm text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button size="sm" onClick={() => void sendSignal('start')}>
                  <PlayIcon size={14} className="mr-2" />Start enrichment run
                </Button>
              </div>
          }
        </div>
      </div>

      {actionMsg && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-sm text-blue-400">{actionMsg}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Pending', value: data?.pendingCount ?? '…', color: 'text-yellow-400' },
          { label: 'Total runs', value: runs.length, color: 'text-foreground' },
          { label: 'Running', value: runningCount, color: 'text-blue-400' },
          { label: 'Success', value: successCount, color: 'text-green-400' },
          { label: 'Errors', value: errorCount, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {data?.lastBatchStats && (
        <div className="rounded-lg border bg-card px-4 py-3 text-xs flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="font-medium text-sm">Last batch</span>
          <span className="text-muted-foreground">
            {data.lastBatchStats.totalTokens.toLocaleString()} tokens
            <span className="text-muted-foreground/60 ml-1">
              ({data.lastBatchStats.promptTokens.toLocaleString()}&uarr; {data.lastBatchStats.completionTokens.toLocaleString()}&darr;)
            </span>
          </span>
          <span className="text-muted-foreground">
            ~${((data.lastBatchStats.promptTokens * 0.15 + data.lastBatchStats.completionTokens * 0.60) / 1_000_000).toFixed(4)}
          </span>
          <span className="text-muted-foreground">{data.lastBatchStats.characters} char{data.lastBatchStats.characters !== 1 ? 's' : ''}</span>
          <Badge className={`text-xs ${STATUS_STYLES[data.lastBatchStats.status] ?? ''}`}>{data.lastBatchStats.status}</Badge>
        </div>
      )}

      {jobActive && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-sm text-blue-300 flex items-center gap-2">
          <ArrowsClockwiseIcon size={16} className="animate-spin shrink-0" />
          Enrichment job is running server-side — pipeline_runs will update as each character completes.
        </div>
      )}

      {runs.length === 0 && !jobActive && (
        <div className="rounded-xl border bg-card px-6 py-10 text-center text-muted-foreground text-sm">
          No pipeline runs yet. Click “Start enrichment run” to enrich pending characters.
        </div>
      )}

      {runs.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Batch</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Character</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Step</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-24">ms</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-36">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.run_batch.slice(0, 7)}…</td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm">{r.character_name ?? r.character_id}</span>
                    {r.character_name && <span className="block text-xs font-mono text-muted-foreground">{r.character_id}</span>}
                  </td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs font-mono">{r.step}</Badge></td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={`text-xs ${STATUS_STYLES[r.status] ?? ''}`}>{r.status}</Badge>
                    {r.error && <p className="text-xs text-destructive mt-0.5 truncate max-w-[12rem]" title={r.error}>{r.error}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{r.duration_ms ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
