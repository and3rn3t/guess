import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersIcon,
  ArrowsClockwiseIcon,
  ListChecksIcon,
  WarningOctagonIcon,
  QueueIcon,
  GameControllerIcon,
  CheckCircleIcon,
  CircleIcon,
} from '@phosphor-icons/react'

interface DashboardStats {
  totalCharacters: number
  enriched: number
  pendingEnrich: number
  activeQuestions: number
  openDisputes: number
  pendingProposals: number
  games7d: number
}

interface RecentGame {
  id: string
  won: number
  questions_asked: number
  character_name: string | null
}

interface DashboardData {
  stats: DashboardStats
  recentGames: RecentGame[]
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  to?: string
  alert?: boolean
}

function StatCard({ label, value, icon, color, to, alert }: StatCardProps): React.JSX.Element {
  const inner = (
    <div className={`rounded-xl border bg-card px-5 py-4 space-y-2 transition-colors ${to ? 'hover:bg-muted/30 cursor-pointer' : ''} ${alert && Number(value) > 0 ? 'border-yellow-500/40' : ''}`}>
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${alert && Number(value) > 0 ? 'text-yellow-500' : ''}`}>
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

export default function LandingRoute(): React.JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/dashboard')
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<DashboardData>
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : 'Failed'); setLoading(false) })
  }, [])

  const s = data?.stats

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mission Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your game database.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card px-5 py-4 h-20 animate-pulse bg-muted" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Characters"
              value={s?.totalCharacters ?? 0}
              icon={<UsersIcon size={14} />}
              color="text-foreground"
              to="characters"
            />
            <StatCard
              label="Enriched"
              value={s?.enriched ?? 0}
              icon={<CheckCircleIcon size={14} />}
              color="text-green-400"
              to="enrichment"
            />
            <StatCard
              label="Pending Enrich"
              value={s?.pendingEnrich ?? 0}
              icon={<ArrowsClockwiseIcon size={14} />}
              color={s && s.pendingEnrich > 0 ? 'text-yellow-400' : 'text-muted-foreground'}
              to="enrichment"
              alert={true}
            />
            <StatCard
              label="Active Questions"
              value={s?.activeQuestions ?? 0}
              icon={<ListChecksIcon size={14} />}
              color="text-violet-400"
              to="questions"
            />
            <StatCard
              label="Open Disputes"
              value={s?.openDisputes ?? 0}
              icon={<WarningOctagonIcon size={14} />}
              color={s && s.openDisputes > 0 ? 'text-yellow-400' : 'text-muted-foreground'}
              to="disputes"
              alert={true}
            />
            <StatCard
              label="Pending Proposals"
              value={s?.pendingProposals ?? 0}
              icon={<QueueIcon size={14} />}
              color={s && s.pendingProposals > 0 ? 'text-violet-400' : 'text-muted-foreground'}
              to="proposed-attrs"
              alert={true}
            />
            <StatCard
              label="Games (7d)"
              value={s?.games7d ?? 0}
              icon={<GameControllerIcon size={14} />}
              color="text-blue-400"
              to="analytics"
            />
          </>
        )}
      </div>

      {/* Recent games */}
      {(data?.recentGames.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Recent Games (24h)</h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Character</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground text-xs w-20">Result</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground text-xs w-24">Questions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.recentGames.map((g) => (
                  <tr key={g.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2">{g.character_name ?? g.id}</td>
                    <td className="px-4 py-2 text-center">
                      {g.won
                        ? <CheckCircleIcon size={14} className="text-green-400 mx-auto" />
                        : <CircleIcon size={14} className="text-muted-foreground mx-auto" />
                      }
                    </td>
                    <td className="px-4 py-2 text-center text-muted-foreground">{g.questions_asked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { to: 'characters', label: 'Manage Characters' },
            { to: 'questions', label: 'Manage Questions' },
            { to: 'enrichment', label: 'Enrichment Status' },
            { to: 'disputes', label: 'Attribute Disputes' },
            { to: 'proposed-attrs', label: 'Proposed Attributes' },
            { to: 'analytics', label: 'Client Analytics' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-lg border bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
