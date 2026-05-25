import type React from 'react'

export interface DashboardStats {
  totalCharacters: number
  enriched: number
  pendingEnrich: number
  activeQuestions: number
  openDisputes: number
  pendingProposals: number
  games7d: number
}

export interface RecentGame {
  id: string
  won: number
  questions_asked: number
  character_name: string | null
}

export interface DashboardData {
  stats: DashboardStats
  recentGames: RecentGame[]
}

export interface PriorityItem {
  key: string
  title: string
  detail: string
  to: string
  tone: 'warning' | 'danger' | 'info'
}

export interface AlertThresholds {
  pendingEnrich: number
  openDisputes: number
  pendingProposals: number
  lowGames7d: number
}

export interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  to?: string
  alert?: boolean
}

export interface WorkflowPlaybook {
  id: string
  title: string
  outcome: string
  primary: { to: string; label: string }
  supporting: Array<{ to: string; label: string }>
}

export interface WorkflowProgress {
  activeTo: string | null
  completed: boolean
}

export type WorkflowProgressMap = Record<string, WorkflowProgress>
export type WorkflowSyncStatus = 'hydrating' | 'syncing' | 'saved' | 'retry'

export const WORKFLOW_PLAYBOOKS: WorkflowPlaybook[] = [
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

export const WORKFLOW_PROGRESS_STORAGE_KEY = 'admin.missionControl.workflowProgress.v1'
export const WORKFLOW_PROGRESS_API = '/api/admin/workflow-progress'
export const THRESHOLDS_STORAGE_KEY = 'admin.missionControl.thresholds.v1'
export const LOADING_CARD_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  pendingEnrich: 0,
  openDisputes: 0,
  pendingProposals: 0,
  lowGames7d: 20,
}

export function buildDefaultWorkflowProgress(): WorkflowProgressMap {
  const entries = WORKFLOW_PLAYBOOKS.map((playbook) => [
    playbook.id,
    { activeTo: null, completed: false },
  ] as const)
  return Object.fromEntries(entries)
}

export function parseWorkflowProgress(raw: string | null): WorkflowProgressMap {
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

export function playbookStepLabel(playbook: WorkflowPlaybook, activeTo: string | null): string {
  if (!activeTo) return 'Not started'
  if (playbook.primary.to === activeTo) return playbook.primary.label
  const match = playbook.supporting.find((step) => step.to === activeTo)
  return match?.label ?? 'Custom step'
}

export function buildPriorityItems(
  stats: DashboardStats | undefined,
  thresholds: AlertThresholds,
): PriorityItem[] {
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

export function priorityToneClasses(tone: PriorityItem['tone']): string {
  if (tone === 'danger') return 'border-red-500/40 bg-red-500/10'
  if (tone === 'warning') return 'border-yellow-500/40 bg-yellow-500/10'
  return 'border-blue-500/30 bg-blue-500/10'
}

export function parseThresholds(raw: string | null): AlertThresholds {
  if (!raw) return DEFAULT_THRESHOLDS
  try {
    const parsed = JSON.parse(raw) as Partial<AlertThresholds>
    return {
      pendingEnrich:
        typeof parsed.pendingEnrich === 'number' ? Math.max(0, parsed.pendingEnrich) : DEFAULT_THRESHOLDS.pendingEnrich,
      openDisputes:
        typeof parsed.openDisputes === 'number' ? Math.max(0, parsed.openDisputes) : DEFAULT_THRESHOLDS.openDisputes,
      pendingProposals:
        typeof parsed.pendingProposals === 'number'
          ? Math.max(0, parsed.pendingProposals)
          : DEFAULT_THRESHOLDS.pendingProposals,
      lowGames7d:
        typeof parsed.lowGames7d === 'number' ? Math.max(0, parsed.lowGames7d) : DEFAULT_THRESHOLDS.lowGames7d,
    }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

export function workflowSyncBadge(status: WorkflowSyncStatus): { label: string; className: string } {
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

export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatRunAge(ranAt: number | null): string {
  if (!ranAt || !Number.isFinite(ranAt)) return 'No run yet'
  const delta = Date.now() - ranAt
  if (delta < 60_000) return `${Math.max(1, Math.floor(delta / 1000))}s ago`
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}

export function stepTone(status: 'inserted' | 'skipped' | 'error' | 'started'): string {
  if (status === 'error') return 'text-red-300'
  if (status === 'skipped') return 'text-muted-foreground'
  return 'text-emerald-300'
}
