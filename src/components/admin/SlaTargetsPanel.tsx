import { useEffect, useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { httpClient } from '@/lib/http'
import type { paths } from '@/lib/api.generated'

type SlaTargetsResponse =
  paths['/api/admin/data-quality-sla']['get']['responses']['200']['content']['application/json']
type SlaTarget = SlaTargetsResponse['targets'][number]

export function SlaTargetsPanel(): React.JSX.Element {
  const [targets, setTargets] = useState<SlaTarget[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    httpClient
      .getJson<SlaTargetsResponse>('/api/admin/data-quality-sla')
      .then((d) => {
        if (d?.targets) {
          setTargets(d.targets)
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load SLA targets')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA Targets</CardTitle>
          <CardDescription>Per-attribute, per-category completeness targets</CardDescription>
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
          <CardTitle>SLA Targets</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!targets || targets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA Targets</CardTitle>
          <CardDescription>No SLA targets available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Group targets by attribute
  const groupedByAttribute = new Map<string, SlaTarget[]>()
  for (const target of targets) {
    if (!groupedByAttribute.has(target.attributeKey)) {
      groupedByAttribute.set(target.attributeKey, [])
    }
    groupedByAttribute.get(target.attributeKey)!.push(target)
  }

  // Sort by attribute key
  const sortedAttributes = Array.from(groupedByAttribute.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Targets</CardTitle>
        <CardDescription>Per-attribute, per-category completeness targets</CardDescription>
      </CardHeader>
      <div className="overflow-x-auto">
        <div className="space-y-6 px-6 pb-6">
          {sortedAttributes.map(([attributeKey, attributeTargets]) => {
            // Sort by category
            const sorted = [...attributeTargets].sort((a, b) => a.category.localeCompare(b.category))
            const displayName = sorted[0]?.displayName || attributeKey

            return (
              <div key={attributeKey} className="space-y-2">
                <div className="font-medium text-sm">{displayName}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {sorted.map((target) => (
                    <div
                      key={`${attributeKey}-${target.category}`}
                      className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <div className="text-xs text-muted-foreground capitalize truncate">
                        {target.category.replace(/-/g, ' ')}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm font-semibold tabular-nums">
                          {(target.target * 100).toFixed(0)}%
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {target.target === 1 ? '✓' : ''}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
