/**
 * B.4 — Question deduplication queue.
 *
 * Lists question pairs whose `attribute_embeddings` are cosine-similar above
 * a configurable threshold (default 0.85). Each row offers three actions:
 *   • Merge → / Merge ←   retire one side into the other (uses AN.17)
 *   • Dismiss             "not duplicates" — pair never resurfaces
 *
 * A "Backfill embeddings" button kicks off `/duplicates/backfill` which
 * embeds questions missing a vector or whose text has changed since the last
 * embed pass.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DuplicatePair {
  pairKey: string
  attributeKeyA: string
  attributeKeyB: string
  textA: string
  textB: string
  similarity: number
}

interface DuplicatesResponse {
  threshold: number
  generatedAt: number
  totalEmbedded: number
  totalQuestions: number
  pairs: DuplicatePair[]
}

interface BackfillResponse {
  embedded: number
  model: string
  dim: number
}

const DEFAULT_THRESHOLD = 0.85

export default function DuplicatesRoute(): React.JSX.Element {
  const [data, setData] = useState<DuplicatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [busyPair, setBusyPair] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const load = useCallback(async (t: number) => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/admin/questions/duplicates?threshold=${encodeURIComponent(t.toFixed(3))}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to load duplicates: ${res.status}`)
      const json = (await res.json()) as DuplicatesResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(threshold)
  }, [load, threshold])

  const handleBackfill = useCallback(async () => {
    setBackfilling(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/admin/questions/duplicates/backfill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      })
      if (!res.ok) throw new Error(`Backfill failed: ${res.status}`)
      const json = (await res.json()) as BackfillResponse
      setStatusMsg(`Embedded ${json.embedded} question(s) with ${json.model}.`)
      await load(threshold)
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Backfill error')
    } finally {
      setBackfilling(false)
    }
  }, [load, threshold])

  const handleDismiss = useCallback(
    async (pair: DuplicatePair) => {
      setBusyPair(pair.pairKey)
      try {
        const res = await fetch('/api/admin/questions/duplicates/dismiss', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairKey: pair.pairKey, similarity: pair.similarity }),
        })
        if (!res.ok) throw new Error(`Dismiss failed: ${res.status}`)
        await load(threshold)
      } catch (e) {
        setStatusMsg(e instanceof Error ? e.message : 'Dismiss error')
      } finally {
        setBusyPair(null)
      }
    },
    [load, threshold],
  )

  const handleMerge = useCallback(
    async (sourceKey: string, targetKey: string, pair: DuplicatePair) => {
      const reason = globalThis.prompt(
        `Merging "${sourceKey}" into "${targetKey}" — retire reason?`,
        `Merged into ${targetKey}`,
      )
      if (reason === null) return
      setBusyPair(pair.pairKey)
      try {
        const res = await fetch('/api/admin/questions/duplicates/merge', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceKey, targetKey, reason }),
        })
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Merge failed: ${res.status} ${body}`)
        }
        setStatusMsg(`Retired "${sourceKey}" → "${targetKey}".`)
        await load(threshold)
      } catch (e) {
        setStatusMsg(e instanceof Error ? e.message : 'Merge error')
      } finally {
        setBusyPair(null)
      }
    },
    [load, threshold],
  )

  const sortedPairs = useMemo(
    () => (data?.pairs ?? []).slice().sort((a, b) => b.similarity - a.similarity),
    [data?.pairs],
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Question Deduplication</h1>
        <p className="text-sm text-muted-foreground">
          Cosine similarity between question embeddings. Merge or dismiss
          near-duplicates to keep the question pool tight.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="threshold">Threshold ({threshold.toFixed(2)})</Label>
          <Input
            id="threshold"
            type="number"
            step={0.01}
            min={0.5}
            max={0.999}
            value={threshold}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) setThreshold(Math.max(0.5, Math.min(0.999, n)))
            }}
            className="w-28"
          />
        </div>
        <Button onClick={() => void load(threshold)} variant="outline" disabled={loading}>
          Refresh
        </Button>
        <Button onClick={() => void handleBackfill()} disabled={backfilling}>
          {backfilling ? 'Embedding…' : 'Backfill embeddings'}
        </Button>
        {data && (
          <p className="text-sm text-muted-foreground ml-auto">
            {data.totalEmbedded} of {data.totalQuestions} questions embedded
          </p>
        )}
      </div>

      {statusMsg && (
        <div className="mb-4 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
          {statusMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && <Skeleton className="h-96 w-full" />}

      {!loading && !error && sortedPairs.length === 0 && (
        <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No duplicate pairs above threshold. Try lowering it or running a backfill.
        </div>
      )}

      {!loading && !error && sortedPairs.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Question A</th>
                <th className="px-3 py-2 text-left font-medium">Question B</th>
                <th className="px-3 py-2 text-right font-medium w-20">Similarity</th>
                <th className="px-3 py-2 text-right font-medium w-72">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPairs.map((pair) => (
                <tr key={pair.pairKey} className="border-t border-border/30">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{pair.textA}</div>
                    <div className="text-xs text-muted-foreground font-mono">{pair.attributeKeyA}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{pair.textB}</div>
                    <div className="text-xs text-muted-foreground font-mono">{pair.attributeKeyB}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(pair.similarity * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyPair === pair.pairKey}
                        onClick={() => void handleMerge(pair.attributeKeyA, pair.attributeKeyB, pair)}
                      >
                        Merge A→B
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyPair === pair.pairKey}
                        onClick={() => void handleMerge(pair.attributeKeyB, pair.attributeKeyA, pair)}
                      >
                        Merge B→A
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyPair === pair.pairKey}
                        onClick={() => void handleDismiss(pair)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
