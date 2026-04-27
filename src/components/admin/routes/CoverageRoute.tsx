import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Warning, CheckCircle, TrendUp, Funnel, Sparkle, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORY_LABELS, type CharacterCategory } from '@/lib/types'

interface CoverageAttribute {
  key: string
  displayText: string
  trueCount: number
  falseCount: number
  nullCount: number
  definedCount: number
  missingCount: number
  coveragePct: number
  diversityScore: number
}

interface CoverageData {
  totalEnriched: number
  totalActive: number
  category: string | null
  attributes: CoverageAttribute[]
}

interface PriorityItem {
  key: string
  displayText: string
  nullPct: number
  reason: string
}

type SortOption = 'coverage' | 'diversity' | 'missing' | 'alphabetical'
type FilterOption = 'all' | 'gaps' | 'complete' | 'partial'

const VALID_CATEGORIES: CharacterCategory[] = [
  'video-games', 'movies', 'anime', 'comics', 'books', 'cartoons', 'tv-shows', 'pop-culture',
]

export default function CoverageRoute(): React.JSX.Element {
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('coverage')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [prioritizing, setPrioritizing] = useState(false)
  const [priorities, setPriorities] = useState<PriorityItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)

    fetch(`/api/admin/coverage?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<CoverageData>
      })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e: unknown) => {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [category])

  const displayAttributes = useMemo(() => {
    if (!data) return []
    let items = [...data.attributes]

    if (filterBy === 'gaps') items = items.filter((a) => a.coveragePct < 100 || a.missingCount > 0)
    else if (filterBy === 'complete') items = items.filter((a) => a.coveragePct === 100)
    else if (filterBy === 'partial') items = items.filter((a) => a.coveragePct > 0 && a.coveragePct < 100)

    items.sort((a, b) => {
      if (sortBy === 'coverage') return a.coveragePct - b.coveragePct
      if (sortBy === 'diversity') return b.diversityScore - a.diversityScore
      if (sortBy === 'missing') return b.missingCount - a.missingCount
      return a.displayText.localeCompare(b.displayText)
    })

    return items
  }, [data, sortBy, filterBy])

  const summary = useMemo(() => {
    if (!data) return null
    const { attributes } = data
    return {
      complete: attributes.filter((a) => a.coveragePct === 100).length,
      partial: attributes.filter((a) => a.coveragePct > 0 && a.coveragePct < 100).length,
      avgCoverage: attributes.length > 0
        ? attributes.reduce((s, a) => s + a.coveragePct, 0) / attributes.length
        : 0,
      totalGaps: attributes.reduce((s, a) => s + a.missingCount, 0),
    }
  }, [data])

  const prioritize = async () => {
    setPrioritizing(true)
    try {
      const res = await fetch('/api/admin/coverage-priority', { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json() as { items: PriorityItem[] }
      setPriorities(json.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Priority analysis failed')
    } finally {
      setPrioritizing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading coverage data…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-destructive">Error: {error ?? 'No data'}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Attribute Coverage Report</h2>
          <p className="text-muted-foreground mt-1">
            {data.totalEnriched.toLocaleString()} enriched characters · {data.totalActive} active attributes
          </p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          <ArrowLeft size={20} className="mr-2" />
          Back
        </Button>
        <Button
          variant="outline"
          onClick={() => void prioritize()}
          disabled={prioritizing}
        >
          <Sparkle size={16} className={`mr-2 ${prioritizing ? 'animate-pulse' : ''}`} />
          {prioritizing ? 'Analyzing…' : 'AI Prioritize'}
        </Button>
      </div>

      {/* AI Priority Card */}
      {priorities !== null && (
        <Card className="bg-violet-500/10 border-violet-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-violet-300">AI Enrichment Priorities</CardTitle>
              <button onClick={() => setPriorities(null)} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sparse attributes found above threshold.</p>
            ) : (
              <ol className="space-y-2">
                {priorities.map((item, i) => (
                  <li key={item.key} className="flex gap-3 text-sm">
                    <span className="text-violet-400 font-bold w-5 shrink-0">{i + 1}.</span>
                    <div>
                      <span className="font-medium text-violet-200">{item.displayText}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{item.key}</span>
                      <span className="ml-2 text-xs text-yellow-400">{item.nullPct}% null</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Enriched Characters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.totalEnriched.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">with at least one attribute</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.avgCoverage.toFixed(1)}%</div>
              <Progress value={summary.avgCoverage} className="mt-2 h-2" />
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Complete Attrs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{summary.complete}</div>
              <p className="text-xs text-muted-foreground mt-1">{summary.partial} partial</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{summary.totalGaps.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">missing attribute values</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Funnel size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {VALID_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="gaps">Has gaps</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              <TrendUp size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sort:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coverage">Coverage ↑</SelectItem>
                  <SelectItem value="diversity">Diversity ↓</SelectItem>
                  <SelectItem value="missing">Missing ↓</SelectItem>
                  <SelectItem value="alphabetical">A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            Showing {displayAttributes.length} of {data.totalActive} attributes
          </CardDescription>
          <div className="space-y-3">
            {displayAttributes.map((attr) => (
              <div key={attr.key} className="flex items-center gap-4 py-2 border-b border-border/40 last:border-0">
                <div className="w-48 shrink-0">
                  <p className="text-sm font-medium truncate">{attr.displayText}</p>
                  <p className="text-xs text-muted-foreground font-mono">{attr.key}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Progress value={attr.coveragePct} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right">{attr.coveragePct}%</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="text-emerald-400">✓ {attr.trueCount}</span>
                    <span className="text-rose-400">✗ {attr.falseCount}</span>
                    <span>? {attr.nullCount}</span>
                    {attr.missingCount > 0 && <span className="text-amber-400">⚠ {attr.missingCount} missing</span>}
                  </div>
                </div>
                <div className="w-24 text-right shrink-0">
                  {attr.coveragePct === 100 ? (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/50 text-xs">
                      <CheckCircle size={10} className="mr-1" /> Complete
                    </Badge>
                  ) : attr.missingCount > 0 ? (
                    <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-xs">
                      <Warning size={10} className="mr-1" /> Gap
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

