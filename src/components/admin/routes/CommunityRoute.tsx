import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircleIcon, XCircleIcon, ArrowsClockwiseIcon, UsersThreeIcon } from '@phosphor-icons/react'

interface AttributeVote {
  attribute: string
  yesVotes: number
  noVotes: number
  net: number
}

interface CorrectionItem {
  characterId: string
  name: string
  totalVotes: number
  attributes: AttributeVote[]
}

interface PageData {
  items: CorrectionItem[]
  total: number
}

export default function CommunityRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/community')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const sendAction = async (characterId: string, action: 'apply' | 'dismiss') => {
    setActing(characterId)
    try {
      const res = await fetch('/api/admin/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, characterId }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Community Contributions</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.total} character{data.total !== 1 ? 's' : ''} with pending correction votes
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <ArrowsClockwiseIcon size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {data?.total === 0 && !loading && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <UsersThreeIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            No pending community corrections. Corrections are auto-applied at {3} votes — anything remaining here hasn't reached the threshold yet.
          </p>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 h-20 animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {(data?.items ?? []).map((item) => (
          <div key={item.characterId} className="rounded-xl border bg-card overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors text-left"
              onClick={() => setExpanded((e) => e === item.characterId ? null : item.characterId)}
            >
              <div className="space-y-0.5">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{item.characterId}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">{item.totalVotes} vote{item.totalVotes !== 1 ? 's' : ''}</Badge>
                <Badge variant="outline" className="text-xs">{item.attributes.length} attr{item.attributes.length !== 1 ? 's' : ''}</Badge>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-400 border-green-500/40 hover:bg-green-500/10"
                    disabled={acting === item.characterId}
                    onClick={(e) => { e.stopPropagation(); void sendAction(item.characterId, 'apply') }}
                  >
                    <CheckCircleIcon size={14} className="mr-1.5" />Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-400 border-red-500/40 hover:bg-red-500/10"
                    disabled={acting === item.characterId}
                    onClick={(e) => { e.stopPropagation(); void sendAction(item.characterId, 'dismiss') }}
                  >
                    <XCircleIcon size={14} className="mr-1.5" />Dismiss
                  </Button>
                </div>
              </div>
            </button>

            {expanded === item.characterId && (
              <div className="border-t border-border bg-muted/20 px-5 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left pb-2 font-medium">Attribute</th>
                      <th className="text-center pb-2 font-medium w-16">Yes</th>
                      <th className="text-center pb-2 font-medium w-16">No</th>
                      <th className="text-center pb-2 font-medium w-20">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {item.attributes.map((a) => (
                      <tr key={a.attribute}>
                        <td className="py-2 font-mono text-xs">{a.attribute}</td>
                        <td className="py-2 text-center text-green-400 text-xs">{a.yesVotes}</td>
                        <td className="py-2 text-center text-red-400 text-xs">{a.noVotes}</td>
                        <td className="py-2 text-center text-xs">
                          <Badge className={a.net > 0 ? 'bg-green-500/20 text-green-400 text-xs' : 'bg-red-500/20 text-red-400 text-xs'}>
                            {a.net > 0 ? '+' : ''}{a.net}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
