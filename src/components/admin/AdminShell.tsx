import { useState, useCallback } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
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
} from '@phosphor-icons/react'
import { useAdminData } from './AdminDataContext'
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
  { to: 'characters', label: 'Characters', icon: <UsersIcon size={16} weight="duotone" /> },
  { to: 'questions', label: 'Questions', icon: <ListChecksIcon size={16} weight="duotone" /> },
  { to: 'questions/retire', label: 'Retirement Queue', icon: <TrashIcon size={16} weight="duotone" /> },
  { to: 'questions/duplicates', label: 'Duplicate Queue', icon: <CopySimpleIcon size={16} weight="duotone" /> },
  { to: 'enrichment', label: 'Enrichment Status', icon: <ArrowsClockwiseIcon size={16} weight="duotone" /> },
  { to: 'pipeline', label: 'Pipeline Log', icon: <TreeStructureIcon size={16} weight="duotone" /> },
  { to: 'analytics', label: 'Analytics', icon: <ChartBarIcon size={16} weight="duotone" /> },
  { to: 'funnel', label: 'Skip Funnel', icon: <ChartLineIcon size={16} weight="duotone" /> },
  { to: 'confusion', label: 'Confusion Matrix', icon: <GridFourIcon size={16} weight="duotone" /> },
  { to: 'matrix', label: 'DNA Matrix', icon: <DnaIcon size={16} weight="duotone" /> },
  { to: 'experiments', label: 'Experiments (A/B)', icon: <FlaskIcon size={16} weight="duotone" /> },
]

const INSIGHT_ITEMS: NavItem[] = [
  { to: 'coverage', label: 'Attribute Coverage', icon: <ChartBarIcon size={16} weight="duotone" /> },
  { to: 'cost', label: 'Cost Dashboard', icon: <ChartLineIcon size={16} weight="duotone" /> },
  { to: 'data-quality', label: 'Data Quality', icon: <ChartLineIcon size={16} weight="fill" /> },
]

const TOOLBOX_ITEMS: NavItem[] = [
  { to: 'hygiene', label: 'Data Hygiene', icon: <WrenchIcon size={16} weight="duotone" /> },
  { to: 'recommender', label: 'Attr Recommender', icon: <LightningIcon size={16} weight="duotone" /> },
  { to: 'category-recommender', label: 'Category Recommender', icon: <TreeStructureIcon size={16} weight="duotone" /> },
  { to: 'stress-test', label: 'Stress Test', icon: <TargetIcon size={16} weight="duotone" /> },
]

const PIPELINE_ITEMS: NavItem[] = [
  { to: 'enrich', label: 'Live Enrichment', icon: <LightningIcon size={16} weight="duotone" /> },
  { to: 'proposed-attrs', label: 'Proposed Attrs', icon: <QueueIcon size={16} weight="duotone" /> },
  { to: 'disputes', label: 'Attr Disputes', icon: <WarningOctagonIcon size={16} weight="duotone" /> },
  { to: 'community', label: 'Community Queue', icon: <UsersThreeIcon size={16} weight="duotone" /> },
  { to: 'error-logs', label: 'Error Logs', icon: <WarningOctagonIcon size={16} weight="fill" /> },
  { to: 'triage', label: 'Failure Triage', icon: <WarningOctagonIcon size={16} weight="duotone" /> },
]

const OVERFLOW_ITEMS: NavItem[] = [
  { to: 'env', label: 'Environment Test', icon: <FlaskIcon size={16} weight="duotone" /> },
  { to: 'bulk-habitat', label: 'Bulk Habitat', icon: <ArrowsClockwiseIcon size={16} weight="duotone" /> },
  { to: 'demo', label: 'Question Gen Demo', icon: <BugIcon size={16} weight="duotone" /> },
]

function SidebarSection({
  title,
  items,
  storageKey,
  color = 'default',
  defaultOpen = true,
}: {
  title: string
  items: NavItem[]
  storageKey: string
  color?: SectionColor
  defaultOpen?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(`admin-nav-${storageKey}`)
    return stored !== null ? stored === 'true' : defaultOpen
  })

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
          className={cn('transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')}
        />
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {items.map((item) => (
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
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminShell(): React.JSX.Element {
  const { characterLimit, setCharacterLimit, characters, loading } = useAdminData()

  return (
    <LiveOpsProvider>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r border-border/60 flex flex-col py-4 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2 px-3 mb-5">
            <HouseIcon size={18} weight="duotone" className="text-accent" />
            <NavLink
              to="."
              end
              className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
            >
              Admin
            </NavLink>
            <span className="ml-auto">
              <HealthBadge />
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-1">
            <SidebarSection title="Data" items={DATA_ITEMS} storageKey="data" color="blue" />
            <SidebarSection title="Insights" items={INSIGHT_ITEMS} storageKey="insights" color="violet" />
            <SidebarSection title="Toolbox" items={TOOLBOX_ITEMS} storageKey="toolbox" color="amber" />
            <SidebarSection title="Pipeline" items={PIPELINE_ITEMS} storageKey="pipeline" color="emerald" />
            <SidebarSection title="More" items={OVERFLOW_ITEMS} storageKey="more" defaultOpen={false} />
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
