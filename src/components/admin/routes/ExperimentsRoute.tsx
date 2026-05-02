import { useEffect, useState, useCallback } from 'react'
import { AdminPageHeader } from '../AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'

interface ArmStat {
  variant: string
  selector: string
  games: number
  wins: number
  winRate: number
  avgQuestions: number | null
  avgConfidence: number | null
  z: number | null
  pValue: number | null
  ci95: number
}

interface ExperimentsData {
  windowDays: number
  config: {
    pct: number
    selector: string | null
    weights: string | null
    activeWeights: string | null
    autoTuneEnabled: boolean
  }
  arms: ArmStat[]
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function fmtNum(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function pValueBadge(p: number | null): React.JSX.Element {
  if (p === null) return <span className="text-muted-foreground">—</span>
  let cls = 'bg-muted text-muted-foreground'
  let label = `p = ${p.toFixed(3)}`
  if (p < 0.01) {
    cls = 'bg-emerald-500/20 text-emerald-300'
    label = `p < 0.01`
  } else if (p < 0.05) {
    cls = 'bg-emerald-500/15 text-emerald-300'
    label = `p < 0.05`
  } else if (p < 0.1) {
    cls = 'bg-amber-500/15 text-amber-300'
  }
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
}

export default function ExperimentsRoute(): React.JSX.Element {
  const [data, setData] = useState<ExperimentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(14)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/experiments?days=${days}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as ExperimentsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [days])

  const updateConfig = useCallback(
    async (body: { pct?: number; selector?: 'greedy' | 'mcts'; autoTuneEnabled?: boolean }) => {
      try {
        const res = await fetch('/api/admin/experiments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await fetchData()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed')
      }
    },
    [fetchData]
  )

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const control = data?.arms.find((a) => a.variant === 'control')
  const totalGames = data?.arms.reduce((sum, a) => sum + a.games, 0) ?? 0

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Experiments (A/B)"
        subtitle="Variant performance comparison"
        sectionColor="blue"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Window:</span>
        <select
          aria-label="Window size in days"
          value={days}
          onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
          className="bg-muted rounded px-2 py-0.5 text-xs"
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data && <Skeleton className="h-64 w-full" />}

      {data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Live split</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{data.config.pct}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.config.pct > 0
                  ? `routed to ${data.config.selector ?? '—'}`
                  : 'experiment off — 100% control'}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Total games</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{totalGames.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">across all arms in window</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Control win rate</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {control ? pct(control.winRate) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {control ? `${control.games.toLocaleString()} games · ±${(control.ci95 * 100).toFixed(1)}%` : 'no control data'}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-border/60 bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Variant</th>
                  <th className="text-left px-4 py-2">Selector</th>
                  <th className="text-right px-4 py-2">Games</th>
                  <th className="text-right px-4 py-2">Win rate (95% CI)</th>
                  <th className="text-right px-4 py-2">Avg Q</th>
                  <th className="text-right px-4 py-2">Avg conf</th>
                  <th className="text-right px-4 py-2">Δ vs control</th>
                  <th className="text-right px-4 py-2">Significance</th>
                </tr>
              </thead>
              <tbody>
                {data.arms.map((arm) => {
                  const delta = control && arm.variant !== 'control' ? arm.winRate - control.winRate : null
                  return (
                    <tr key={`${arm.variant}-${arm.selector}`} className="border-t border-border/60">
                      <td className="px-4 py-2 font-medium">{arm.variant}</td>
                      <td className="px-4 py-2">{arm.selector}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{arm.games.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {pct(arm.winRate)}{' '}
                        <span className="text-muted-foreground text-xs">±{(arm.ci95 * 100).toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtNum(arm.avgQuestions, 1)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtNum(arm.avgConfidence, 2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {delta === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                            {delta >= 0 ? '+' : ''}
                            {(delta * 100).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{pValueBadge(arm.pValue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-border/60 bg-card p-4 space-y-2 text-sm">
            <h2 className="font-semibold">Promotion checklist</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>≥500 games per arm</li>
              <li>p &lt; 0.05 vs control on win rate</li>
              <li>positive delta (or neutral with shorter avg Q)</li>
              <li>no regression in average confidence</li>
            </ul>
            <p className="text-xs text-muted-foreground/80 pt-2">
              The weekly <code className="rounded bg-muted px-1">engine-self-tune</code> workflow promotes{' '}
              <code className="rounded bg-muted px-1">kv:ab:experiment-weights</code> to{' '}
              <code className="rounded bg-muted px-1">kv:engine:weights-active</code> automatically when these criteria are met.
            </p>
          </section>

          <section className="rounded-lg border border-border/60 bg-card p-4 space-y-3 text-sm">
            <h2 className="font-semibold flex items-center gap-2">
              Live controls
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Experiment %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={data.config.pct}
                  onBlur={(e) => {
                    const v = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(v) && v !== data.config.pct) void updateConfig({ pct: v })
                  }}
                  className="rounded bg-muted px-2 py-1 text-sm tabular-nums"
                  aria-label="Experiment percentage"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Selector</span>
                <select
                  defaultValue={data.config.selector ?? 'mcts'}
                  onChange={(e) => {
                    const v = e.target.value as 'greedy' | 'mcts'
                    if (v !== data.config.selector) void updateConfig({ selector: v })
                  }}
                  className="rounded bg-muted px-2 py-1 text-sm"
                  aria-label="Experiment selector"
                >
                  <option value="mcts">mcts</option>
                  <option value="greedy">greedy</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Auto-tune</span>
                <button
                  type="button"
                  onClick={() => void updateConfig({ autoTuneEnabled: !data.config.autoTuneEnabled })}
                  className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
                    data.config.autoTuneEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {data.config.autoTuneEnabled ? 'ENABLED' : 'DISABLED'} — click to toggle
                </button>
              </label>
            </div>
            {data.config.activeWeights && (
              <p className="text-xs text-muted-foreground">
                Active weights: <code className="rounded bg-muted px-1">{data.config.activeWeights}</code>
              </p>
            )}
            {data.config.weights && (
              <p className="text-xs text-muted-foreground">
                Candidate weights: <code className="rounded bg-muted px-1">{data.config.weights}</code>
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
