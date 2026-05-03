import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageHeader } from '../AdminPageHeader'
import { FreshnessPill } from '../FreshnessPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  UsersIcon,
  ArrowsClockwiseIcon,
  ListChecksIcon,
  WarningOctagonIcon,
  QueueIcon,
  GameControllerIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockCountdownIcon,
  SparkleIcon,
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

interface PriorityItem {
  key: string
  title: string
  detail: string
  to: string
  tone: 'warning' | 'danger' | 'info'
}

interface AlertThresholds {
  pendingEnrich: number
  openDisputes: number
  pendingProposals: number
  lowGames7d: number
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  to?: string
  alert?: boolean
}

interface WorkflowPlaybook {
  id: string
  title: string
  outcome: string
  primary: { to: string; label: string }
  supporting: Array<{ to: string; label: string }>
}

interface WorkflowProgress {
  activeTo: string | null
  completed: boolean
}

type WorkflowProgressMap = Record<string, WorkflowProgress>
type WorkflowSyncStatus = 'hydrating' | 'syncing' | 'saved' | 'retry'

const WORKFLOW_PLAYBOOKS: WorkflowPlaybook[] = [
  {
    id: 'curate-core',
    title: 'Curate Core Data',
    outcome: 'Keep character/question quality high before model iteration.',
    primary: { to: 'characters', label: 'Start in Characters' },
    supporting: [
      { to: 'questions', label: 'Questions' },
      { to: 'questions/duplicates', label: 'Duplicate Queue' },
      { to: 'data-quality', label: 'Data Quality' },
    ],
  },
  {
    id: 'expand-knowledge',
    title: 'Expand Knowledge Base',
    outcome: 'Increase discriminative attributes and keep enrichment flowing.',
    primary: { to: 'recommender', label: 'Start in Attribute Recommender' },
    supporting: [
      { to: 'category-recommender', label: 'Category Recommender' },
      { to: 'enrichment', label: 'Enrichment Status' },
      { to: 'pipeline', label: 'Pipeline Log' },
    ],
  },
  {
    id: 'govern-inputs',
    title: 'Govern Community Inputs',
    outcome: 'Resolve incoming community changes safely and consistently.',
    primary: { to: 'proposed-attrs', label: 'Start in Proposed Attributes' },
    supporting: [
      { to: 'disputes', label: 'Attribute Disputes' },
      { to: 'community', label: 'Community Queue' },
      { to: 'triage', label: 'Failure Triage' },
    ],
  },
  {
    id: 'monitor-loop',
    title: 'Monitor & Improve Loop',
    outcome: 'Track behavior and close the loop on friction and regressions.',
    primary: { to: 'analytics', label: 'Start in Analytics' },
    supporting: [
      { to: 'funnel', label: 'Skip Funnel' },
      { to: 'confusion', label: 'Confusion Matrix' },
      { to: 'experiments', label: 'Experiments' },
    ],
  },
]

const WORKFLOW_PROGRESS_STORAGE_KEY = 'admin.missionControl.workflowProgress.v1'
const WORKFLOW_PROGRESS_API = '/api/admin/workflow-progress'

function buildDefaultWorkflowProgress(): WorkflowProgressMap {
  const entries = WORKFLOW_PLAYBOOKS.map((playbook) => [
    playbook.id,
    { activeTo: null, completed: false },
  ] as const)
  return Object.fromEntries(entries)
}

function parseWorkflowProgress(raw: string | null): WorkflowProgressMap {
  const defaults = buildDefaultWorkflowProgress()
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return defaults

    const next: WorkflowProgressMap = { ...defaults }
    for (const playbook of WORKFLOW_PLAYBOOKS) {
      const candidate = (parsed as Record<string, unknown>)[playbook.id]
      if (typeof candidate !== 'object' || candidate === null) continue
      const progress = candidate as Record<string, unknown>
      next[playbook.id] = {
        activeTo: typeof progress.activeTo === 'string' ? progress.activeTo : null,
        completed: progress.completed === true,
      }
    }
    return next
  } catch {
    return defaults
  }
}

function playbookStepLabel(playbook: WorkflowPlaybook, activeTo: string | null): string {
  if (!activeTo) return 'Not started'
  if (playbook.primary.to === activeTo) return playbook.primary.label
  const match = playbook.supporting.find((step) => step.to === activeTo)
  return match?.label ?? 'Custom step'
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

function buildPriorityItems(stats: DashboardStats | undefined, thresholds: AlertThresholds): PriorityItem[] {
  if (!stats) return []

  const items: PriorityItem[] = []
  if (stats.pendingEnrich > thresholds.pendingEnrich) {
    items.push({
      key: 'enrich',
      title: `${stats.pendingEnrich} characters need enrichment`,
      detail: 'Run enrichment to improve question quality and confidence.',
      to: 'enrichment',
      tone: 'warning',
    })
  }
  if (stats.openDisputes > thresholds.openDisputes) {
    items.push({
      key: 'disputes',
      title: `${stats.openDisputes} open attribute disputes`,
      detail: 'Resolve conflicts before they impact engine behavior.',
      to: 'disputes',
      tone: 'danger',
    })
  }
  if (stats.pendingProposals > thresholds.pendingProposals) {
    items.push({
      key: 'proposals',
      title: `${stats.pendingProposals} attribute proposals pending review`,
      detail: 'Approve or reject proposed attributes to keep taxonomy clean.',
      to: 'proposed-attrs',
      tone: 'info',
    })
  }
  if (stats.games7d < thresholds.lowGames7d) {
    items.push({
      key: 'engagement',
      title: 'Low weekly game volume detected',
      detail: 'Inspect funnel and drop-off events in analytics.',
      to: 'analytics',
      tone: 'info',
    })
  }
  return items
}

function priorityToneClasses(tone: PriorityItem['tone']): string {
  if (tone === 'danger') return 'border-red-500/40 bg-red-500/10'
  if (tone === 'warning') return 'border-yellow-500/40 bg-yellow-500/10'
  return 'border-blue-500/30 bg-blue-500/10'
}

const LOADING_CARD_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']
const THRESHOLDS_STORAGE_KEY = 'admin.missionControl.thresholds.v1'
const DEFAULT_THRESHOLDS: AlertThresholds = {
  pendingEnrich: 0,
  openDisputes: 0,
  pendingProposals: 0,
  lowGames7d: 20,
}

function parseThresholds(raw: string | null): AlertThresholds {
  if (!raw) return DEFAULT_THRESHOLDS
  try {
    const parsed = JSON.parse(raw) as Partial<AlertThresholds>
    return {
      pendingEnrich: typeof parsed.pendingEnrich === 'number' ? Math.max(0, parsed.pendingEnrich) : DEFAULT_THRESHOLDS.pendingEnrich,
      openDisputes: typeof parsed.openDisputes === 'number' ? Math.max(0, parsed.openDisputes) : DEFAULT_THRESHOLDS.openDisputes,
      pendingProposals: typeof parsed.pendingProposals === 'number' ? Math.max(0, parsed.pendingProposals) : DEFAULT_THRESHOLDS.pendingProposals,
      lowGames7d: typeof parsed.lowGames7d === 'number' ? Math.max(0, parsed.lowGames7d) : DEFAULT_THRESHOLDS.lowGames7d,
    }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

function workflowSyncBadge(status: WorkflowSyncStatus): { label: string; className: string } {
  if (status === 'saved') {
    return { label: 'Saved', className: 'bg-emerald-500/20 text-emerald-300' }
  }
  if (status === 'syncing') {
    return { label: 'Syncing', className: 'bg-blue-500/20 text-blue-300' }
  }
  if (status === 'hydrating') {
    return { label: 'Hydrating', className: 'bg-muted text-muted-foreground' }
  }
  return { label: 'Retry', className: 'bg-amber-500/20 text-amber-300' }
}

function useWorkflowProgressSync(): {
  workflowProgress: WorkflowProgressMap
  workflowSyncStatus: WorkflowSyncStatus
  completedPlaybooks: number
  setPlaybookActiveStep: (playbookId: string, to: string) => void
  togglePlaybookCompleted: (playbookId: string) => void
  resetPlaybook: (playbookId: string) => void
} {
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgressMap>(buildDefaultWorkflowProgress())
  const [workflowProgressHydrated, setWorkflowProgressHydrated] = useState(false)
  const [workflowSyncStatus, setWorkflowSyncStatus] = useState<WorkflowSyncStatus>('hydrating')
  const lastSyncedWorkflowProgress = useRef<string>('')

  useEffect(() => {
    const stored = localStorage.getItem(WORKFLOW_PROGRESS_STORAGE_KEY)
    setWorkflowProgress(parseWorkflowProgress(stored))

    void fetch(WORKFLOW_PROGRESS_API)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const parsed = parseWorkflowProgress(
          json && typeof json === 'object' && 'progress' in (json as Record<string, unknown>)
            ? JSON.stringify((json as { progress: unknown }).progress)
            : null,
        )
        setWorkflowProgress(parsed)
        lastSyncedWorkflowProgress.current = JSON.stringify(parsed)
        setWorkflowSyncStatus('saved')
      })
      .catch(() => {
        setWorkflowSyncStatus('retry')
      })
      .finally(() => {
        setWorkflowProgressHydrated(true)
      })
  }, [])

  useEffect(() => {
    localStorage.setItem(WORKFLOW_PROGRESS_STORAGE_KEY, JSON.stringify(workflowProgress))
  }, [workflowProgress])

  useEffect(() => {
    if (!workflowProgressHydrated) return

    const serialized = JSON.stringify(workflowProgress)
    if (serialized === lastSyncedWorkflowProgress.current) return

    const timer = setTimeout(() => {
      setWorkflowSyncStatus('syncing')
      void fetch(WORKFLOW_PROGRESS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: workflowProgress }),
      })
        .then((response) => {
          if (!response.ok) {
            setWorkflowSyncStatus('retry')
            return
          }
          lastSyncedWorkflowProgress.current = serialized
          setWorkflowSyncStatus('saved')
        })
        .catch(() => {
          setWorkflowSyncStatus('retry')
        })
    }, 250)

    return () => clearTimeout(timer)
  }, [workflowProgress, workflowProgressHydrated])

  const setPlaybookActiveStep = (playbookId: string, to: string) => {
    setWorkflowProgress((prev) => ({
      ...prev,
      [playbookId]: {
        activeTo: to,
        completed: prev[playbookId]?.completed ?? false,
      },
    }))
  }

  const togglePlaybookCompleted = (playbookId: string) => {
    setWorkflowProgress((prev) => ({
      ...prev,
      [playbookId]: {
        activeTo: prev[playbookId]?.activeTo ?? null,
        completed: !(prev[playbookId]?.completed ?? false),
      },
    }))
  }

  const resetPlaybook = (playbookId: string) => {
    setWorkflowProgress((prev) => ({
      ...prev,
      [playbookId]: { activeTo: null, completed: false },
    }))
  }

  const completedPlaybooks = WORKFLOW_PLAYBOOKS.filter((playbook) => workflowProgress[playbook.id]?.completed).length

  return {
    workflowProgress,
    workflowSyncStatus,
    completedPlaybooks,
    setPlaybookActiveStep,
    togglePlaybookCompleted,
    resetPlaybook,
  }
}

export default function LandingRoute(): React.JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS)
  const {
    workflowProgress,
    workflowSyncStatus,
    completedPlaybooks,
    setPlaybookActiveStep,
    togglePlaybookCompleted,
    resetPlaybook,
  } = useWorkflowProgressSync()

  const setThreshold = (field: keyof AlertThresholds, value: string) => {
    const next = Number.parseInt(value, 10)
    setThresholds((prev) => ({
      ...prev,
      [field]: Number.isNaN(next) ? 0 : Math.max(0, next),
    }))
  }

  const fetchDashboard = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/dashboard')
      if (!response.ok) throw new Error(`${response.status}`)
      const json = await response.json() as DashboardData
      setData(json)
      setLastFetchedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(THRESHOLDS_STORAGE_KEY)
    setThresholds(parseThresholds(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  useEffect(() => {
    void fetchDashboard()
  }, [])

  const s = data?.stats
  const enrichmentPct = s && s.totalCharacters > 0 ? Math.round((s.enriched / s.totalCharacters) * 100) : 0
  const proposalLoad = s ? s.pendingProposals + s.openDisputes : 0
  const priorityItems = buildPriorityItems(s, thresholds)
  const syncBadge = workflowSyncBadge(workflowSyncStatus)

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-8">
      <AdminPageHeader
        title="Mission Control"
        subtitle="Overview of your game database"
        actions={
          <div className="flex items-center gap-2">
            <FreshnessPill fetchedAt={lastFetchedAt} onRefresh={() => void fetchDashboard()} refreshing={loading} />
            <Button variant="outline" size="sm" onClick={() => void fetchDashboard()} disabled={loading}>
              <ArrowsClockwiseIcon size={14} className="mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          LOADING_CARD_KEYS.map((cardKey) => (
            <div key={cardKey} className="rounded-xl border px-5 py-4 h-20 animate-pulse bg-muted" />
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Priority Queue</h2>
            <ClockCountdownIcon size={14} className="text-muted-foreground" />
          </div>
          {priorityItems.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              No urgent actions. System looks healthy.
            </div>
          ) : (
            <div className="space-y-2">
              {priorityItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`block rounded-lg border px-3 py-2 transition-colors hover:bg-muted/30 ${priorityToneClasses(item.tone)}`}
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Operational Health</h2>
            <SparkleIcon size={14} className="text-violet-400" />
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Character coverage</span>
                <span>{enrichmentPct}%</span>
              </div>
              <progress value={enrichmentPct} max={100} className="h-2 w-full rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded border border-border px-2 py-2">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pending</div>
                <div className="text-sm font-semibold text-yellow-400">{s?.pendingEnrich ?? 0}</div>
              </div>
              <div className="rounded border border-border px-2 py-2">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Review Load</div>
                <div className="text-sm font-semibold text-violet-400">{proposalLoad}</div>
              </div>
              <div className="rounded border border-border px-2 py-2">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Games 7d</div>
                <div className="text-sm font-semibold text-blue-400">{s?.games7d ?? 0}</div>
              </div>
            </div>
            <div className="pt-2 space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Alert thresholds</div>
              <div className="grid grid-cols-2 gap-2">
                <label htmlFor="threshold-pending-enrich" className="text-xs text-muted-foreground">
                  Pending enrich
                  <Input
                    id="threshold-pending-enrich"
                    type="number"
                    min={0}
                    value={thresholds.pendingEnrich}
                    onChange={(event) => setThreshold('pendingEnrich', event.target.value)}
                    className="mt-1 h-8"
                  />
                </label>
                <label htmlFor="threshold-open-disputes" className="text-xs text-muted-foreground">
                  Open disputes
                  <Input
                    id="threshold-open-disputes"
                    type="number"
                    min={0}
                    value={thresholds.openDisputes}
                    onChange={(event) => setThreshold('openDisputes', event.target.value)}
                    className="mt-1 h-8"
                  />
                </label>
                <label htmlFor="threshold-pending-proposals" className="text-xs text-muted-foreground">
                  Pending proposals
                  <Input
                    id="threshold-pending-proposals"
                    type="number"
                    min={0}
                    value={thresholds.pendingProposals}
                    onChange={(event) => setThreshold('pendingProposals', event.target.value)}
                    className="mt-1 h-8"
                  />
                </label>
                <label htmlFor="threshold-low-games" className="text-xs text-muted-foreground">
                  Low games (7d)
                  <Input
                    id="threshold-low-games"
                    type="number"
                    min={0}
                    value={thresholds.lowGames7d}
                    onChange={(event) => setThreshold('lowGames7d', event.target.value)}
                    className="mt-1 h-8"
                  />
                </label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="px-0 text-muted-foreground"
                onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
              >
                Reset thresholds
              </Button>
            </div>
          </div>
        </div>
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

      {/* Workflow playbooks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Workflow Playbooks</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{completedPlaybooks}/{WORKFLOW_PLAYBOOKS.length} completed</span>
            <span className={`rounded-full px-2 py-0.5 uppercase tracking-widest text-[10px] ${syncBadge.className}`}>
              {syncBadge.label}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WORKFLOW_PLAYBOOKS.map((playbook) => (
            <div key={playbook.id} className="rounded-xl border bg-card px-4 py-4 space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{playbook.title}</h3>
                  {workflowProgress[playbook.id]?.completed ? (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                      Complete
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{playbook.outcome}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Active step: {playbookStepLabel(playbook, workflowProgress[playbook.id]?.activeTo ?? null)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={playbook.primary.to}
                  onClick={() => setPlaybookActiveStep(playbook.id, playbook.primary.to)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    workflowProgress[playbook.id]?.activeTo === playbook.primary.to
                      ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
                  }`}
                >
                  {playbook.primary.label}
                </Link>
                {playbook.supporting.map((step) => (
                  <Link
                    key={step.to}
                    to={step.to}
                    onClick={() => setPlaybookActiveStep(playbook.id, step.to)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      workflowProgress[playbook.id]?.activeTo === step.to
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    {step.label}
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePlaybookCompleted(playbook.id)}
                  className="h-7 text-xs"
                >
                  {workflowProgress[playbook.id]?.completed ? 'Mark in progress' : 'Mark complete'}
                </Button>
                <button
                  type="button"
                  onClick={() => resetPlaybook(playbook.id)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
