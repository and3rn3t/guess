import { useState, useCallback, useMemo, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  ChartBarIcon,
  FlaskIcon,
  UsersIcon,
  ListChecksIcon,
  TreeStructureIcon,
  ArrowsClockwiseIcon,
  QueueIcon,
  UsersThreeIcon,
  LightningIcon,
  HouseIcon,
  WrenchIcon,
  ChartLineIcon,
  BugIcon,
  WarningOctagonIcon,
  GridFourIcon,
  DnaIcon,
  TargetIcon,
  CopySimpleIcon,
  TrashIcon,
  CaretDownIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { useAdminData } from './AdminDataContext'
import { AdminCommandPalette, type CommandSection } from './AdminCommandPalette'
import { LiveOpsProvider } from './LiveOpsContext'
import { LiveOpsStrip } from './LiveOpsStrip'
import { HealthBadge } from './HealthBadge'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

type SectionColor = 'blue' | 'violet' | 'amber' | 'emerald' | 'default'

const COLOR_MAP: Record<SectionColor, { title: string; activeItem: string }> = {
  blue: {
    title: 'text-blue-400/70 hover:text-blue-400',
    activeItem: 'bg-blue-400/10 text-blue-400',
  },
  violet: {
    title: 'text-violet-400/70 hover:text-violet-400',
    activeItem: 'bg-violet-400/10 text-violet-400',
  },
  amber: {
    title: 'text-amber-400/70 hover:text-amber-400',
    activeItem: 'bg-amber-400/10 text-amber-400',
  },
  emerald: {
    title: 'text-emerald-400/70 hover:text-emerald-400',
    activeItem: 'bg-emerald-400/10 text-emerald-400',
  },
  default: {
    title: 'text-muted-foreground/60 hover:text-muted-foreground',
    activeItem: 'bg-accent/20 text-accent',
  },
}

const DATA_ITEMS: NavItem[] = [
  { to: '.', label: 'Mission Control', icon: <HouseIcon size={16} weight="duotone" /> },
]

const WORKFLOW_CURATE_ITEMS: NavItem[] = [
  { to: 'characters', label: 'Characters', icon: <UsersIcon size={16} weight="duotone" /> },
  { to: 'data-quality', label: 'Data Quality', icon: <ChartLineIcon size={16} weight="fill" /> },
  { to: 'hygiene', label: 'Data Hygiene', icon: <WrenchIcon size={16} weight="duotone" /> },
  { to: 'questions', label: 'Questions', icon: <ListChecksIcon size={16} weight="duotone" /> },
  { to: 'coverage', label: 'Attribute Coverage', icon: <ChartBarIcon size={16} weight="duotone" /> },
  { to: 'questions/retire', label: 'Retirement Queue', icon: <TrashIcon size={16} weight="duotone" /> },
  { to: 'questions/duplicates', label: 'Duplicate Queue', icon: <CopySimpleIcon size={16} weight="duotone" /> },
]

const WORKFLOW_EXPAND_ITEMS: NavItem[] = [
  { to: 'recommender', label: 'Attribute Recommender', icon: <LightningIcon size={16} weight="duotone" /> },
  { to: 'category-recommender', label: 'Category Recommender', icon: <TreeStructureIcon size={16} weight="duotone" /> },
  { to: 'enrich', label: 'Live Enrichment', icon: <LightningIcon size={16} weight="duotone" /> },
  { to: 'enrichment', label: 'Enrichment Status', icon: <ArrowsClockwiseIcon size={16} weight="duotone" /> },
  { to: 'pipeline', label: 'Pipeline Log', icon: <TreeStructureIcon size={16} weight="duotone" /> },
  { to: 'matrix', label: 'DNA Matrix', icon: <DnaIcon size={16} weight="duotone" /> },
]

const WORKFLOW_GOVERN_ITEMS: NavItem[] = [
  { to: 'proposed-attrs', label: 'Proposed Attrs', icon: <QueueIcon size={16} weight="duotone" /> },
  { to: 'disputes', label: 'Attr Disputes', icon: <WarningOctagonIcon size={16} weight="duotone" /> },
  { to: 'community', label: 'Community Queue', icon: <UsersThreeIcon size={16} weight="duotone" /> },
]

const WORKFLOW_MONITOR_ITEMS: NavItem[] = [
  { to: 'analytics', label: 'Analytics', icon: <ChartBarIcon size={16} weight="duotone" /> },
  { to: 'funnel', label: 'Skip Funnel', icon: <ChartLineIcon size={16} weight="duotone" /> },
  { to: 'confusion', label: 'Confusion Matrix', icon: <GridFourIcon size={16} weight="duotone" /> },
  { to: 'experiments', label: 'Experiments (A/B)', icon: <FlaskIcon size={16} weight="duotone" /> },
  { to: 'cost', label: 'Cost Dashboard', icon: <ChartLineIcon size={16} weight="duotone" /> },
  { to: 'error-logs', label: 'Error Logs', icon: <WarningOctagonIcon size={16} weight="fill" /> },
  { to: 'triage', label: 'Failure Triage', icon: <WarningOctagonIcon size={16} weight="duotone" /> },
]

const OVERFLOW_ITEMS: NavItem[] = [
  { to: 'api-docs', label: 'API Docs', icon: <ListChecksIcon size={16} weight="duotone" /> },
  { to: 'stress-test', label: 'Stress Test', icon: <TargetIcon size={16} weight="duotone" /> },
  { to: 'env', label: 'Environment Test', icon: <FlaskIcon size={16} weight="duotone" /> },
  { to: 'bulk-habitat', label: 'Bulk Habitat', icon: <ArrowsClockwiseIcon size={16} weight="duotone" /> },
  { to: 'demo', label: 'Question Gen Demo', icon: <BugIcon size={16} weight="duotone" /> },
]

/** Fetches badge counts for actionable queues once on mount. */
function useBadgeCounts(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => (r.ok ? (r.json() as Promise<{ stats: Record<string, number> }>) : null))
      .then((d) => {
        if (!d?.stats) return
        const next: Record<string, number> = {}
        if (d.stats.openDisputes > 0) next['disputes'] = d.stats.openDisputes
        if (d.stats.pendingProposals > 0) next['proposed-attrs'] = d.stats.pendingProposals
        setCounts(next)
      })
      .catch(() => {})
  }, [])
  return counts
}

function SidebarSection({
  title,
  items,
  storageKey,
  color = 'default',
  defaultOpen = true,
  badgeMap,
}: Readonly<{
  title: string
  items: NavItem[]
  storageKey: string
  color?: SectionColor
  defaultOpen?: boolean
  badgeMap?: Record<string, number>
}>): React.JSX.Element {
  const location = useLocation()

  const hasActiveChild = useMemo(
    () =>
      items.some((item) => {
        const path = `/${item.to}`
        return location.pathname === path || location.pathname.startsWith(`${path}/`)
      }),
    [items, location.pathname]
  )

  const [open, setOpen] = useState<boolean>(() => {
    if (hasActiveChild) return true
    const stored = localStorage.getItem(`admin-nav-${storageKey}`)
    if (stored === null) return defaultOpen
    return stored === 'true'
  })

  // Force-open when user navigates into a child while the section is collapsed
  const effectiveOpen = open || hasActiveChild

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(`admin-nav-${storageKey}`, String(next))
      return next
    })
  }, [storageKey])

  const colors = COLOR_MAP[color]

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors rounded-sm',
          colors.title
        )}
      >
        <span className="flex-1 text-left">{title}</span>
        <CaretDownIcon
          size={12}
          weight="bold"
          className={cn('transition-transform duration-200', effectiveOpen ? 'rotate-0' : '-rotate-90')}
        />
      </button>
      {effectiveOpen && (
        <ul className="mt-0.5 space-y-0.5">
          {items.map((item) => {
            const badge = badgeMap?.[item.to]
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? cn(colors.activeItem, 'font-medium')
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span className="text-[10px] font-semibold tabular-nums bg-amber-500/20 text-amber-400 rounded-full px-1.5 min-w-4.5 text-center leading-4 py-px">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function AdminShell(): React.JSX.Element {
  const { characterLimit, setCharacterLimit, characters, loading } = useAdminData()
  const badgeCounts = useBadgeCounts()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const commandSections: CommandSection[] = [
    { title: 'Mission Control', items: DATA_ITEMS },
    { title: 'Curate Core Data', items: WORKFLOW_CURATE_ITEMS },
    { title: 'Expand Knowledge', items: WORKFLOW_EXPAND_ITEMS },
    { title: 'Govern Community Input', items: WORKFLOW_GOVERN_ITEMS },
    { title: 'Monitor & Improve', items: WORKFLOW_MONITOR_ITEMS },
    { title: 'Labs & Utilities', items: OVERFLOW_ITEMS },
  ]

  return (
    <LiveOpsProvider>
      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sections={commandSections}
      />
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r border-border/60 flex flex-col py-4 px-2 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="flex items-center gap-2 px-3 mb-5">
            <HouseIcon size={18} weight="duotone" className="text-accent" />
            <NavLink
              to="."
              end
              className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
            >
              Admin
            </NavLink>
            <span className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title="Search (⌘K)"
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded p-0.5"
              >
                <MagnifyingGlassIcon size={14} />
              </button>
              <HealthBadge />
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-1">
            <SidebarSection title="Mission Control" items={DATA_ITEMS} storageKey="mission-control" color="blue" />
            <SidebarSection title="Curate Core Data" items={WORKFLOW_CURATE_ITEMS} storageKey="curate" color="blue" />
            <SidebarSection title="Expand Knowledge" items={WORKFLOW_EXPAND_ITEMS} storageKey="expand" color="amber" />
            <SidebarSection title="Govern Community Input" items={WORKFLOW_GOVERN_ITEMS} storageKey="govern" color="emerald" badgeMap={badgeCounts} />
            <SidebarSection title="Monitor & Improve" items={WORKFLOW_MONITOR_ITEMS} storageKey="monitor" color="violet" />
            <SidebarSection title="Labs & Utilities" items={OVERFLOW_ITEMS} storageKey="labs" defaultOpen={false} />
          </nav>

          {/* Working-set selector */}
          <div className="mt-4 px-3 border-t border-border/40 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Working set
            </p>
            <Select
              value={String(characterLimit)}
              onValueChange={(v) => setCharacterLimit(Number(v))}
              disabled={loading}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">Top 50</SelectItem>
                <SelectItem value="100">Top 100</SelectItem>
                <SelectItem value="200">Top 200</SelectItem>
                <SelectItem value="500">Top 500</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              {loading ? 'Loading…' : `${characters.length} chars loaded`}
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col">
          <LiveOpsStrip />
          <div className="flex-1">
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
    </LiveOpsProvider>
  )
}
