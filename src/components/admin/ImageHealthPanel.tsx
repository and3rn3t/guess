// @vitest-environment jsdom
import { useEffect, useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface ImageHealthPerCategory {
  category: string
  total: number
  withImage: number
  validR2Url: number
  imageCoveragePct: number
}

interface ImageHealthIssue {
  characterId: string
  characterName: string
  category: string
  issueType: 'missing-url' | 'invalid-url' | 'external-url'
  reason: string
  popularity: number
}

interface ImageHealthResponse {
  totals: {
    totalCharacters: number
    withImage: number
    validR2Url: number
    missingUrl: number
    invalidUrl: number
    externalUrl: number
    usablePct: number
  }
  perCategory: ImageHealthPerCategory[]
  issues: ImageHealthIssue[]
}

export function ImageHealthPanel(): React.JSX.Element {
  const [data, setData] = useState<ImageHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/image-health')
      .then((r) => (r.ok ? (r.json() as Promise<ImageHealthResponse>) : null))
      .then((d) => {
        if (d) {
          setData(d)
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load image health')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Image Health</CardTitle>
          <CardDescription>Character portrait completeness and quality</CardDescription>
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
          <CardTitle>Image Health</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Image Health</CardTitle>
          <CardDescription>No image health data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`

  const getIssueColor = (type: string): string => {
    switch (type) {
      case 'missing-url':
        return 'bg-red-100 text-red-800'
      case 'invalid-url':
        return 'bg-yellow-100 text-yellow-800'
      case 'external-url':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Health</CardTitle>
        <CardDescription>Character portrait completeness and quality</CardDescription>
      </CardHeader>
      <div className="space-y-6 px-6 pb-6">
        {/* Overall metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg bg-accent/50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Total Characters</div>
            <div className="text-xl font-bold">{data.totals.totalCharacters}</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Usable Portraits</div>
            <div className="text-xl font-bold">{pct(data.totals.usablePct)}</div>
            <div className="text-xs text-muted-foreground">{data.totals.validR2Url} characters</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Missing URLs</div>
            <div className="text-xl font-bold">{data.totals.missingUrl}</div>
          </div>
          <div className="rounded-lg bg-yellow-50 p-3">
            <div className="text-sm font-medium text-muted-foreground">Invalid URLs</div>
            <div className="text-xl font-bold">{data.totals.invalidUrl}</div>
          </div>
        </div>

        {/* Per-category breakdown */}
        {data.perCategory.length > 0 && (
          <div>
            <h4 className="mb-3 font-semibold">By Category</h4>
            <div className="space-y-2">
              {data.perCategory.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="font-medium">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {cat.validR2Url}/{cat.total}
                    </span>
                    <Badge
                      variant={cat.imageCoveragePct >= 0.9 ? 'default' : cat.imageCoveragePct >= 0.7 ? 'secondary' : 'destructive'}
                    >
                      {pct(cat.imageCoveragePct)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top issues */}
        {data.issues.length > 0 && (
          <div>
            <h4 className="mb-3 font-semibold">Top Issues (by popularity)</h4>
            <div className="space-y-2">
              {data.issues.slice(0, 10).map((issue) => (
                <div key={`${issue.characterId}-${issue.issueType}`} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div>
                    <div className="font-medium">{issue.characterName}</div>
                    <div className="text-xs text-muted-foreground">{issue.category}</div>
                  </div>
                  <Badge className={getIssueColor(issue.issueType)} variant="outline">
                    {issue.issueType === 'missing-url' ? 'No URL' : issue.issueType === 'invalid-url' ? 'Malformed' : 'External'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
