import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowsClockwiseIcon, TargetIcon } from '@phosphor-icons/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface StressSummary {
  total: number
  winPct: number
  avgQuestions: number
  avgConfidence: number
}

interface HardestChar {
  id: string
  name: string
  games: number
  winPct: number
  avgQuestions: number
}

interface ByDifficulty {
  difficulty: string
  total: number
  winPct: number
  avgQuestions: number
}

interface RecentRun {
  runId: string
  games: number
  winPct: number
  startedAt: number
  difficulty: string
}

interface StressData {
  hasData: boolean
  message?: string
  total?: number
  summary?: StressSummary
  hardest?: HardestChar[]
  byDifficulty?: ByDifficulty[]
  recentRuns?: RecentRun[]
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#10b981',
  medium: '#2563eb',
  hard: '#d97706',
  extreme: '#dc2626',
}

function winPctColor(pct: number): string {
  if (pct >= 80) return 'text-green-400'
  if (pct >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

export default function StressTestRoute(): React.JSX.Element {
  const [data, setData] = useState<StressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stress-test')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const difficultyData = (data?.byDifficulty ?? []).map((d) => ({
    name: d.difficulty,
    winPct: d.winPct,
    games: d.total,
    avgQ: d.avgQuestions,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stress Test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulation results — run <code className="text-xs bg-muted px-1 py-0.5 rounded">pnpm simulate --all --write-db</code> to populate
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
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-4">
          <TargetIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">{data.message}</p>
          <div className="inline-block text-left bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground font-mono">
            <p className="mb-1"># Export data first</p>
            <p>pnpm simulate:export</p>
            <p className="mt-2 mb-1"># Run simulation and write to DB</p>
            <p>pnpm simulate --all --write-db</p>
          </div>
        </div>
      )}

      {!loading && data?.hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total games', value: data.total?.toLocaleString() ?? '—' },
              { label: 'Win rate', value: `${data.summary?.winPct ?? '—'}%`, highlight: winPctColor(data.summary?.winPct ?? 0) },
              { label: 'Avg questions', value: data.summary?.avgQuestions ?? '—' },
              { label: 'Avg confidence', value: data.summary?.avgConfidence != null ? `${(data.summary.avgConfidence * 100).toFixed(1)}%` : '—' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border bg-card px-4 py-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold ${card.highlight ?? ''}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Win rate by difficulty */}
          {difficultyData.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Win Rate by Difficulty</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={difficultyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v, name) => name === 'winPct' ? [`${v}%`, 'Win rate'] : [v, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="winPct" radius={[4, 4, 0, 0]}>
                    {difficultyData.map((d) => (
                      <Cell key={d.name} fill={DIFFICULTY_COLORS[d.name] ?? '#7c3aed'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Hardest characters */}
          {(data.hardest?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Hardest Characters to Guess</p>
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Character</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Games</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Win %</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28">Avg Q's</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data.hardest ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{c.name}</td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">{c.games}</td>
                        <td className={`px-4 py-2.5 text-center text-xs font-semibold ${winPctColor(c.winPct)}`}>{c.winPct}%</td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{c.avgQuestions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent runs */}
          {(data.recentRuns?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent Simulation Runs</p>
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Run ID</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Difficulty</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Games</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Win %</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground w-36">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data.recentRuns ?? []).map((r) => (
                      <tr key={r.runId} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.runId.slice(0, 12)}&hellip;</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${DIFFICULTY_COLORS[r.difficulty] ?? '#7c3aed'}22`, color: DIFFICULTY_COLORS[r.difficulty] ?? '#7c3aed' }}>
                            {r.difficulty}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{r.games}</td>
                        <td className={`px-4 py-2.5 text-center text-xs font-semibold ${winPctColor(r.winPct)}`}>{r.winPct}%</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          {new Date(r.startedAt * 1000).toLocaleString()}
                        </td>
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
