// @vitest-environment jsdom
import { useEffect, useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface CurationQueueItem {
  id: number
  characterId: string
  attributeKey: string
  issueType: 'cannot_infer' | 'canon_conflict' | 'subjective'
  issueReason: string
  category: string
  assignedTo: string | null
  resolvedAt: number | null
  locked: boolean
  lockedUntil: number | null
  lockReason: string | null
  agedDays: number
  popularity: number
  priorityScore: number
}

interface CurationQueueResponse {
  report: {
    totals: {
      totalItems: number
      unresolved: number
      assigned: number
      locked: number
      avgAgedDays: number
    }
    perIssueType: Record<string, { count: number; percentOfTotal: number }>
    items: CurationQueueItem[]
  }
  fetchedAt: number
  limit: number
}

export function CuratorQueuePanel(): React.JSX.Element {
  const [data, setData] = useState<CurationQueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/curator-queue')
      .then((r) => (r.ok ? (r.json() as Promise<CurationQueueResponse>) : null))
      .then((d) => {
        if (d) {
          setData(d)
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load curator queue')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curator Queue</CardTitle>
          <CardDescription>Ambiguous cases awaiting human review</CardDescription>
        </CardHeader>
        <div className="px-6 py-8">
          <Skeleton className="h-40 w-full" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curator Queue</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curator Queue</CardTitle>
          <CardDescription>No curator queue data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`
  const getIssueColor = (type: string): string => {
    switch (type) {
      case 'canon_conflict':
        return 'bg-red-100 text-red-800'
      case 'cannot_infer':
        return 'bg-yellow-100 text-yellow-800'
      case 'subjective':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (item: CurationQueueItem): string => {
    if (item.resolvedAt) return 'bg-green-50'
    if (item.locked) return 'bg-blue-50'
    if (item.assignedTo) return 'bg-purple-50'
    return 'bg-white'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curator Queue</CardTitle>
        <CardDescription>Ambiguous cases awaiting human review and resolution</CardDescription>
      </CardHeader>
      <div className="space-y-6 px-6 pb-6">
        {/* Overall metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-lg bg-accent/50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Total Items</div>
            <div className="text-xl font-bold">{data.report.totals.totalItems}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Unresolved</div>
            <div className="text-xl font-bold">{data.report.totals.unresolved}</div>
          </div>
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Assigned</div>
            <div className="text-xl font-bold">{data.report.totals.assigned}</div>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Locked</div>
            <div className="text-xl font-bold">{data.report.totals.locked}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Avg Age</div>
            <div className="text-xl font-bold">{data.report.totals.avgAgedDays}d</div>
          </div>
        </div>

        {/* Per-issue-type breakdown */}
        <div>
          <h4 className="mb-3 font-semibold">By Issue Type</h4>
          <div className="space-y-2">
            {Object.entries(data.report.perIssueType).map(([type, { count, percentOfTotal }]) => (
              <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{count}</span>
                  <Badge variant="secondary">{pct(percentOfTotal / 100)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top items needing action */}
        {data.report.items.length > 0 && (
          <div>
            <h4 className="mb-3 font-semibold">Top Items Needing Action</h4>
            <div className="space-y-2">
              {data.report.items.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 ${getStatusColor(item)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.characterId} · {item.attributeKey}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.issueReason}</div>
                    </div>
                    <Badge className={getIssueColor(item.issueType)}>
                      {item.issueType.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {item.category} · {item.agedDays}d old · {pct(item.popularity)}
                    </span>
                    {item.assignedTo && (
                      <Badge variant="outline" className="text-xs">
                        👤 {item.assignedTo}
                      </Badge>
                    )}
                    {item.locked && (
                      <Badge variant="secondary" className="text-xs">
                        🔒 Locked
                      </Badge>
                    )}
                    {item.resolvedAt && (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        ✓ Resolved
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.report.items.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <div className="text-sm text-muted-foreground">No unresolved curator queue items</div>
          </div>
        )}
      </div>
    </Card>
  )
}
