import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminPageHeader } from '../AdminPageHeader'
import { FreshnessPill } from '../FreshnessPill'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartBarIcon } from '@phosphor-icons/react'
import { httpClient } from '@/lib/http'
import type { paths } from '@/lib/api.generated'

type ConfusionData =
  paths['/api/admin/confusion']['get']['responses']['200']['content']['application/json']
type ConfusionSource = ConfusionData['source']
type ConfusionPair = ConfusionData['pairs'][number]

const SOURCE_COPY: Record<ConfusionSource, { subtitle: string; tableLabel: string }> = {
  real: {
    subtitle: 'Pairs the engine most often confuses in real games (from character_confusions, undirected)',
    tableLabel: 'Top confused pairs (real games)',
  },
  sim: {
    subtitle: 'Characters the AI most often confuses in headless simulations (directional, with win %)',
    tableLabel: 'Top confused pairs (simulation)',
  },
}

function HeatCell({ value, max }: Readonly<{ value: number; max: number }>): React.JSX.Element {
  const intensity = max > 0 ? value / max : 0
  let toneClass = 'bg-violet-900/20'
  if (intensity >= 0.8) toneClass = 'bg-violet-500/80'
  else if (intensity >= 0.6) toneClass = 'bg-violet-500/70'
  else if (intensity >= 0.4) toneClass = 'bg-violet-500/60'
  else if (intensity >= 0.2) toneClass = 'bg-violet-500/45'
  else if (intensity > 0) toneClass = 'bg-violet-500/30'

  return (
    <span
      className={`inline-flex items-center justify-center w-full h-full text-xs font-bold text-white rounded ${toneClass}`}
    >
      {value}
    </span>
  )
}

function confusionPillClass(confusionCount: number, maxConfusions: number): string {
  const intensity = maxConfusions > 0 ? confusionCount / maxConfusions : 0
  if (intensity >= 0.8) return 'bg-violet-500/90'
  if (intensity >= 0.6) return 'bg-violet-500/80'
  if (intensity >= 0.4) return 'bg-violet-500/70'
  if (intensity >= 0.2) return 'bg-violet-500/55'
  return 'bg-violet-500/40'
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

function isSource(value: string | null): value is ConfusionSource {
  return value === 'real' || value === 'sim'
}

export default function ConfusionRoute(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const sourceParam = searchParams.get('source')
  const source: ConfusionSource = isSource(sourceParam) ? sourceParam : 'real'

  const [data, setData] = useState<ConfusionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (src: ConfusionSource): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const json = await httpClient.getJson<ConfusionData>(
        `/api/admin/confusion?source=${src}&limit=60&minConfusions=2`,
      )
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(source)
  }, [source])

  const handleSourceChange = (next: string): void => {
    if (!isSource(next) || next === source) return
    const params = new URLSearchParams(searchParams)
    if (next === 'real') params.delete('source')
    else params.set('source', next)
    setSearchParams(params, { replace: true })
  }

  const maxConfusions = Math.max(...(data?.pairs.map((p) => p.confusionCount) ?? [1]))
  const targets = [...new Set(data?.pairs.map((p) => p.targetName) ?? [])].slice(0, 20)
  const confusors = [...new Set(data?.pairs.map((p) => p.confusedWithName) ?? [])].slice(0, 20)

  const lookup = new Map<string, number>()
  for (const p of data?.pairs ?? []) {
    lookup.set(`${p.targetName}::${p.confusedWithName}`, p.confusionCount)
  }

  const copy = SOURCE_COPY[source]
  const trailingHeader = source === 'real' ? 'Last seen' : 'Win %'
  const leftHeader = source === 'real' ? 'Character A' : 'Target'
  const rightHeader = source === 'real' ? 'Character B' : 'Confused with'

  const renderTrailing = (p: ConfusionPair): React.JSX.Element => {
    if (source === 'real' && p.lastSeen != null) {
      return <span>{relativeTime(p.lastSeen, data?.generatedAt ?? Date.now())}</span>
    }
    if (source === 'sim' && p.winPct != null) {
      let tone = 'text-red-400'
      if (p.winPct >= 70) tone = 'text-green-400'
      else if (p.winPct >= 40) tone = 'text-yellow-400'
      return <span className={tone}>{p.winPct}%</span>
    }
    return <span>—</span>
  }

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Confusion Matrix"
        subtitle={copy.subtitle}
        sectionColor="violet"
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
          <TabsTrigger value="real">Real games</TabsTrigger>
          <TabsTrigger value="sim">Simulation</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && <div className="rounded-xl border bg-card p-8 animate-pulse h-64" />}

      {!loading && data?.message && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <ChartBarIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">{data.message}</p>
        </div>
      )}

      {!loading && !data?.message && (data?.pairs.length ?? 0) > 0 && (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {copy.tableLabel} ({data!.pairs.slice(0, 20).length} shown)
            </p>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{leftHeader}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{rightHeader}</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28">Confusions</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">{trailingHeader}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.pairs ?? []).slice(0, 20).map((p) => (
                    <tr
                      key={`${p.targetId}::${p.confusedWithId}`}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{p.targetName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.confusedWithName}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${confusionPillClass(p.confusionCount, maxConfusions)}`}
                        >
                          {p.confusionCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                        {renderTrailing(p)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {targets.length > 1 && confusors.length > 1 && (
            <div className="space-y-2 overflow-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Heatmap (rows = {source === 'real' ? 'character A' : 'target'}, cols ={' '}
                {source === 'real' ? 'character B' : 'confused with'})
              </p>
              <div className="rounded-xl border bg-card p-4 overflow-auto">
                <table className="text-xs border-collapse min-w-max">
                  <thead>
                    <tr>
                      <th className="w-28" />
                      {confusors.map((c) => (
                        <th
                          key={c}
                          className="w-10 pb-2 text-muted-foreground font-normal [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 max-h-20"
                        >
                          {c.length > 12 ? `${c.slice(0, 11)}\u2026` : c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t) => (
                      <tr key={t}>
                        <td className="pr-2 text-right text-muted-foreground whitespace-nowrap max-w-25 overflow-hidden text-ellipsis">
                          {t.length > 14 ? `${t.slice(0, 13)}\u2026` : t}
                        </td>
                        {confusors.map((c) => {
                          const val = lookup.get(`${t}::${c}`) ?? 0
                          return (
                            <td
                              key={c}
                              className="w-10 h-8 p-0.5"
                              title={val > 0 ? `${t} confused with ${c}: ${val}x` : undefined}
                            >
                              {val > 0 ? (
                                <HeatCell value={val} max={maxConfusions} />
                              ) : (
                                <span className="inline-block w-full h-full rounded bg-muted/20" />
                              )}
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
