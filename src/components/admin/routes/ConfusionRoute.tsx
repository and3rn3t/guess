import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowsClockwiseIcon, ChartBarIcon } from '@phosphor-icons/react'

interface ConfusionPair {
  targetId: string
  targetName: string
  confusedWithId: string
  confusedWithName: string
  confusionCount: number
  winPct: number
}

interface ConfusionData {
  pairs: ConfusionPair[]
  total: number
  message?: string
}

function HeatCell({ value, max }: { value: number; max: number }): React.JSX.Element {
  const intensity = max > 0 ? value / max : 0
  const bg = `rgba(124, 58, 237, ${0.1 + intensity * 0.7})`
  return (
    <span
      className="inline-flex items-center justify-center w-full h-full text-xs font-bold text-white rounded"
      style={{ background: bg }}
    >
      {value}
    </span>
  )
}

export default function ConfusionRoute(): React.JSX.Element {
  const [data, setData] = useState<ConfusionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/confusion?limit=60&minConfusions=2')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const maxConfusions = Math.max(...(data?.pairs.map((p) => p.confusionCount) ?? [1]))

  // Get unique targets and confusors for the matrix axes
  const targets = [...new Set(data?.pairs.map((p) => p.targetName) ?? [])].slice(0, 20)
  const confusors = [...new Set(data?.pairs.map((p) => p.confusedWithName) ?? [])].slice(0, 20)

  // Build lookup for fast access
  const lookup = new Map<string, number>()
  for (const p of (data?.pairs ?? [])) {
    lookup.set(`${p.targetName}::${p.confusedWithName}`, p.confusionCount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Confusion Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Characters the AI most often confuses (from simulation data)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <ArrowsClockwiseIcon size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {loading && (
        <div className="rounded-xl border bg-card p-8 animate-pulse h-64" />
      )}

      {!loading && data?.message && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <ChartBarIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">{data.message}</p>
        </div>
      )}

      {!loading && !data?.message && (data?.pairs.length ?? 0) > 0 && (
        <>
          {/* Top confused pairs table */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Top Confused Pairs ({data!.pairs.slice(0, 20).length} shown)
            </p>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Target</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Confused with</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28">Confusions</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Win %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.pairs ?? []).slice(0, 20).map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{p.targetName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.confusedWithName}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                          style={{ background: `rgba(124, 58, 237, ${0.2 + (p.confusionCount / maxConfusions) * 0.7})` }}
                        >
                          {p.confusionCount}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-center text-xs font-medium ${p.winPct >= 70 ? 'text-green-400' : p.winPct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {p.winPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mini heatmap grid (up to 15×15) */}
          {targets.length > 1 && confusors.length > 1 && (
            <div className="space-y-2 overflow-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Heatmap (rows = target, cols = confused with)
              </p>
              <div className="rounded-xl border bg-card p-4 overflow-auto">
                <table className="text-xs border-collapse" style={{ minWidth: `${confusors.length * 40 + 120}px` }}>
                  <thead>
                    <tr>
                      <th className="w-28" />
                      {confusors.map((c) => (
                        <th key={c} className="w-10 pb-2 text-muted-foreground font-normal" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', maxHeight: 80 }}>
                          {c.length > 12 ? `${c.slice(0, 11)}\u2026` : c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t) => (
                      <tr key={t}>
                        <td className="pr-2 text-right text-muted-foreground whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">
                          {t.length > 14 ? `${t.slice(0, 13)}\u2026` : t}
                        </td>
                        {confusors.map((c) => {
                          const val = lookup.get(`${t}::${c}`) ?? 0
                          return (
                            <td key={c} className="w-10 h-8 p-0.5" title={val > 0 ? `${t} confused with ${c}: ${val}x` : undefined}>
                              {val > 0 ? <HeatCell value={val} max={maxConfusions} /> : <span className="inline-block w-full h-full rounded bg-muted/20" />}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
