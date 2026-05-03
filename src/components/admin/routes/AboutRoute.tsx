/**
 * Admin `/admin/about` route — AP.22 build & data freshness card.
 *
 * Displays system metadata: deployed commit, schema version, app version,
 * last enrichment/cron runs, and namespace IDs.
 */
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '../AdminPageHeader'

interface AboutData {
  appVersion: string
  schemaVersion: number
  lastEnrichmentRun: {
    timestamp: number | null
    batchId: string | null
  }
  lastCronRun: {
    timestamp: number | null
    name: string | null
  }
  lastD1Backup: {
    timestamp: number | null
  }
}

const relativeTime = (timestamp: number | null) => {
  if (!timestamp) return 'Never'
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

const formatDate = (timestamp: number | null) => {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString()
}

export default function AboutRoute(): React.JSX.Element {
  const [data, setData] = useState<AboutData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAbout = async () => {
      try {
        const response = await globalThis.fetch('/api/admin/about')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = (await response.json()) as AboutData
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch')
      } finally {
        setLoading(false)
      }
    }
    loadAbout()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="About" subtitle="System metadata and deployment info" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <>
        <AdminPageHeader title="About" subtitle="System metadata and deployment info" />
        <Alert variant="destructive">
          <AlertDescription>Failed to load system info: {error}</AlertDescription>
        </Alert>
      </>
    )
  }

  return (
    <>
      <AdminPageHeader title="About" subtitle="System metadata and deployment info" />

      <div className="space-y-6">
        {/* App & Deployment */}
        <Card>
          <CardHeader>
            <CardTitle>Application</CardTitle>
            <CardDescription>Build and schema information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">App Version</div>
                <div className="font-mono text-sm mt-1">{data.appVersion}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Schema Version</div>
                <div className="font-mono text-sm mt-1">Migration {data.schemaVersion}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Freshness */}
        <Card>
          <CardHeader>
            <CardTitle>Data Freshness</CardTitle>
            <CardDescription>Last automatic refresh times</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {data.lastCronRun.timestamp && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Last Cron Run</div>
                  <div className="text-sm font-mono mt-1">
                    {relativeTime(data.lastCronRun.timestamp)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(data.lastCronRun.timestamp)}
                  </div>
                </div>
              )}
              {data.lastEnrichmentRun.timestamp && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Last Enrichment Run</div>
                  <div className="text-sm font-mono mt-1">
                    {relativeTime(data.lastEnrichmentRun.timestamp)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(data.lastEnrichmentRun.timestamp)}
                  </div>
                  {data.lastEnrichmentRun.batchId && (
                    <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block w-fit">
                      {data.lastEnrichmentRun.batchId.substring(0, 8)}
                    </code>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
