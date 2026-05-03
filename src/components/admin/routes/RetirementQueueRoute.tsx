import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminPageHeader } from '../AdminPageHeader'
import { Button } from '@/components/ui/button'
import { FreshnessPill } from '../FreshnessPill'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Candidate {
  questionId: string
  text: string | null
  attributeKey: string | null
  shown: number
  skipped: number
  yes: number
  no: number
  maybe: number
  unknown: number
  skipRate: number
  maybeRate: number
  imbalance: number
  retirementScore: number
}

interface RetiredEntry {
  questionId: string
  text: string
  attributeKey: string
  retiredAt: number
  retiredReason: string | null
}

interface QueueResponse {
  source: 'live' | 'retired'
  windowDays: number
  minShown: number
  generatedAt: number
  candidates?: Candidate[]
  retired?: RetiredEntry[]
}

type Source = 'live' | 'retired'

function isSource(value: string | null): value is Source {
  return value === 'live' || value === 'retired'
}

function relativeTime(ms: number, now: number): string {
  const diff = Math.max(0, now - ms)
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function ScoreBadge({ score }: Readonly<{ score: number }>): React.JSX.Element {
  let tone = 'bg-muted/40 text-muted-foreground'
  if (score >= 0.4) tone = 'bg-red-500/15 text-red-400'
  else if (score >= 0.2) tone = 'bg-amber-500/15 text-amber-400'
  return (
    <span
      className={`inline-flex items-center justify-center min-w-12 px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${tone}`}
    >
      {pct(score)}
    </span>
  )
}

export default function RetirementQueueRoute(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const sourceParam = searchParams.get('source')
  const source: Source = isSource(sourceParam) ? sourceParam : 'live'

  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const fetchData = useCallback(async (s: Source): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/questions/retirement-queue?source=${s}&minShown=10&limit=100`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as QueueResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(source)
  }, [source, fetchData])

  function handleSourceChange(next: string): void {
    if (!isSource(next)) return
    if (next === 'live') {
      searchParams.delete('source')
    } else {
      searchParams.set('source', next)
    }
    setSearchParams(searchParams, { replace: true })
  }

  async function retire(attributeKey: string, questionText: string): Promise<void> {
    const reason = globalThis.prompt(
      `Retire "${questionText}"?\n\nOptional reason (max 500 chars):`,
      '',
    )
    if (reason === null) return // cancelled
    setBusyKey(attributeKey)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(attributeKey)}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchData(source)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retire failed')
    } finally {
      setBusyKey(null)
    }
  }

  async function unretire(attributeKey: string): Promise<void> {
    setBusyKey(attributeKey)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(attributeKey)}/unretire`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchData(source)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unretire failed')
    } finally {
      setBusyKey(null)
    }
  }

  const candidates = data?.candidates ?? []
  const retired = data?.retired ?? []

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Question Retirement Queue"
        subtitle={`Last ${data?.windowDays ?? 30} days · min ${data?.minShown ?? 10} impressions`}
        sectionColor="blue"
        breadcrumbs={[{ label: 'Questions', to: '/questions' }, { label: 'Retirement Queue' }]}
        actions={
          <FreshnessPill
            fetchedAt={data?.generatedAt ?? null}
            onRefresh={() => void fetchData(source)}
            refreshing={loading}
          />
        }
      />

      <Tabs value={source} onValueChange={handleSourceChange}>
        <TabsList>
          <TabsTrigger value="live">Live questions</TabsTrigger>
          <TabsTrigger value="retired">Retired ({retired.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load: {error}
        </div>
      )}

      {loading && !data && <Skeleton className="h-96 w-full" />}

      {data && source === 'live' && (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          {candidates.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No live questions meet the threshold yet — keep collecting attempts.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Question</th>
                  <th className="px-3 py-2 text-right">Shown</th>
                  <th className="px-3 py-2 text-right">Skip %</th>
                  <th className="px-3 py-2 text-right">Maybe %</th>
                  <th className="px-3 py-2 text-right">Imbalance</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.questionId} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.text ?? c.questionId}</div>
                      {c.attributeKey && (
                        <div className="text-xs text-muted-foreground">
                          <code>{c.attributeKey}</code>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.shown}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(c.skipRate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(c.maybeRate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(c.imbalance)}</td>
                    <td className="px-3 py-2 text-right">
                      <ScoreBadge score={c.retirementScore} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyKey === c.attributeKey || !c.attributeKey}
                        onClick={() => {
                          if (c.attributeKey) void retire(c.attributeKey, c.text ?? c.questionId)
                        }}
                      >
                        {busyKey === c.attributeKey ? '…' : 'Retire'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {data && source === 'retired' && (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          {retired.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No questions are currently retired.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Question</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-right">Retired</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {retired.map((r) => (
                  <tr key={r.questionId} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.text}</div>
                      <div className="text-xs text-muted-foreground">
                        <code>{r.attributeKey}</code>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.retiredReason ?? <span className="italic">no reason</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {relativeTime(r.retiredAt, data.generatedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyKey === r.attributeKey}
                        onClick={() => void unretire(r.attributeKey)}
                      >
                        {busyKey === r.attributeKey ? '…' : 'Unretire'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
