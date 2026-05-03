/**
 * AN.21 — Failure Triage route (/admin/triage)
 *
 * Lists games where the player's actual character was never in the engine's
 * top-10 candidate list at any step (catastrophic failures).  Clicking a row
 * expands an inline step-by-step replay with the top-10 highlighted.
 */
import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader } from '../AdminPageHeader'
import { FreshnessPill } from '../FreshnessPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TriageListRow {
  id: number
  actual_character_id: string
  actual_character_name: string | null
  min_rank: number | null
  created_at: number
}

interface TopTenEntry {
  id: string
  name: string
}

interface TriageStep {
  attr: string
  answer: string
  questionText: string
  top10: TopTenEntry[]
}

interface TriageDetail {
  id: number
  actualCharacterId: string
  actualCharacterName: string | null
  minRank: number | null
  createdAt: number
  steps: TriageStep[]
}

interface ListResponse {
  rows: TriageListRow[]
  total: number
  limit: number
  offset: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const ANSWER_COLOURS: Record<string, string> = {
  yes:     'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  no:      'bg-red-500/20 text-red-400 border-red-500/30',
  maybe:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepReplay({ detail }: { detail: TriageDetail }): React.JSX.Element {
  return (
    <div className="mt-4 space-y-3 pl-2 border-l-2 border-muted">
      {detail.steps.map((step, i) => (
        <div key={i} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Step {i + 1} — <span className="font-mono text-foreground/80">{step.attr}</span>
          </p>
          <p className="text-sm text-foreground">{step.questionText}</p>
          <Badge
            variant="outline"
            className={`text-xs ${ANSWER_COLOURS[step.answer] ?? ANSWER_COLOURS.unknown}`}
          >
            {step.answer}
          </Badge>
          {step.top10.length > 0 && (
            <ol className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {step.top10.map((e, rank) => (
                <li
                  key={e.id}
                  className={
                    e.id === detail.actualCharacterId
                      ? 'text-amber-400 font-semibold'
                      : undefined
                  }
                >
                  {rank + 1}. {e.name}
                  {e.id === detail.actualCharacterId && ' ← actual'}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  )
}

interface TriageRowProps {
  row: TriageListRow
}

function TriageRow({ row }: TriageRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<TriageDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (detail) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/triage?id=${row.id}`)
      if (!res.ok) throw new Error(await res.text())
      setDetail(await res.json() as TriageDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 text-left"
        type="button"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <CaretDownIcon size={14} className="shrink-0 text-muted-foreground" />
            : <CaretRightIcon size={14} className="shrink-0 text-muted-foreground" />}
          <span className="font-medium text-sm truncate">
            {row.actual_character_name ?? row.actual_character_id}
          </span>
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30 shrink-0">
            never in top-10
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{formatDate(row.created_at)}</span>
      </button>

      {expanded && (
        loading
          ? <p className="mt-3 text-xs text-muted-foreground animate-pulse">Loading replay…</p>
          : error
            ? <p className="mt-3 text-xs text-red-400">{error}</p>
            : detail
              ? <StepReplay detail={detail} />
              : null
      )}
    </li>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function TriageRoute(): React.JSX.Element {
  const [data, setData] = useState<ListResponse | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  const load = useCallback(async (off: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/triage?limit=${PAGE_SIZE}&offset=${off}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json() as ListResponse
      setData(json)
      setOffset(off)
      setLastFetchedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(0) }, [load])

  const total = data?.total ?? 0
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Failure Triage"
        subtitle="Games where the engine never ranked the actual character in its top-10"
        sectionColor="emerald"
        actions={
          <FreshnessPill
            fetchedAt={lastFetchedAt}
            onRefresh={() => void load(offset)}
            refreshing={loading}
          />
        }
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            {total} catastrophic failure{total !== 1 ? 's' : ''} total
            {total > 0 ? ` — showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}` : ''}
          </p>

          {data.rows.length === 0
            ? <p className="text-sm text-muted-foreground">No failures recorded yet.</p>
            : (
              <ul className="space-y-2">
                {data.rows.map((row) => <TriageRow key={row.id} row={row} />)}
              </ul>
            )
          }

          {(hasPrev || hasNext) && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev || loading}
                onClick={() => void load(offset - PAGE_SIZE)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || loading}
                onClick={() => void load(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
