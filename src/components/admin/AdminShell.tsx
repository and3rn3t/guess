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
import {
  ADMIN_ROUTE_MANIFEST,
  type AdminNavIconKey,
  type AdminNavSection,
} from './adminRouteManifest'

interface NavItem {
  to: string
  label: string
  iconKey: AdminNavIconKey | 'house'
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

const SECTION_TITLES: Record<AdminNavSection | 'mission-control', string> = {
  'mission-control': 'Mission Control',
  mission: 'Mission Control',
  curate: 'Curate Core Data',
  expand: 'Expand Knowledge',
  govern: 'Govern Community Input',
  monitor: 'Monitor & Improve',
  labs: 'Labs & Utilities',
}

const SECTION_COLORS: Record<AdminNavSection | 'mission-control', SectionColor> = {
  'mission-control': 'blue',
  mission: 'blue',
  curate: 'blue',
  expand: 'amber',
  govern: 'emerald',
  monitor: 'violet',
  labs: 'default',
}

const SECTION_STORAGE_KEYS: Record<AdminNavSection | 'mission-control', string> = {
  'mission-control': 'mission-control',
  mission: 'mission',
  curate: 'curate',
  expand: 'expand',
  govern: 'govern',
  monitor: 'monitor',
  labs: 'labs',
}

const SECTION_ORDER: Array<AdminNavSection | 'mission-control'> = [
  'mission-control',
  'curate',
  'expand',
  'govern',
  'monitor',
  'labs',
]

function getIcon(iconKey: AdminNavIconKey | 'house'): React.ReactNode {
  switch (iconKey) {
    case 'house':
      return <HouseIcon size={16} weight="duotone" />
    case 'chartBar':
      return <ChartBarIcon size={16} weight="duotone" />
    case 'flask':
      return <FlaskIcon size={16} weight="duotone" />
    case 'users':
      return <UsersIcon size={16} weight="duotone" />
    case 'listChecks':
      return <ListChecksIcon size={16} weight="duotone" />
    case 'treeStructure':
      return <TreeStructureIcon size={16} weight="duotone" />
    case 'arrowsClockwise':
      return <ArrowsClockwiseIcon size={16} weight="duotone" />
    case 'queue':
      return <QueueIcon size={16} weight="duotone" />
    case 'usersThree':
      return <UsersThreeIcon size={16} weight="duotone" />
    case 'lightning':
      return <LightningIcon size={16} weight="duotone" />
    case 'wrench':
      return <WrenchIcon size={16} weight="duotone" />
    case 'chartLine':
      return <ChartLineIcon size={16} weight="duotone" />
    case 'warningOctagon':
      return <WarningOctagonIcon size={16} weight="duotone" />
    case 'gridFour':
      return <GridFourIcon size={16} weight="duotone" />
    case 'dna':
      return <DnaIcon size={16} weight="duotone" />
    case 'target':
      return <TargetIcon size={16} weight="duotone" />
    case 'copySimple':
      return <CopySimpleIcon size={16} weight="duotone" />
    case 'trash':
      return <TrashIcon size={16} weight="duotone" />
  }
}

function buildNavItems(section: AdminNavSection): NavItem[] {
  return ADMIN_ROUTE_MANIFEST
    .filter((route) => route.section === section)
    .map((route) => ({ to: route.path, label: route.label, iconKey: route.iconKey }))
}

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
                  {getIcon(item.iconKey)}
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

  const navBySection: Record<AdminNavSection | 'mission-control', NavItem[]> = useMemo(() => ({
    'mission-control': [{ to: '.', label: 'Mission Control', iconKey: 'house' }],
    mission: buildNavItems('mission'),
    curate: buildNavItems('curate'),
    expand: buildNavItems('expand'),
    govern: buildNavItems('govern'),
    monitor: buildNavItems('monitor'),
    labs: buildNavItems('labs'),
  }), [])

  const commandSections: CommandSection[] = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        title: SECTION_TITLES[section],
        items: navBySection[section].map((item) => ({
          to: item.to,
          label: item.label,
          icon: getIcon(item.iconKey),
        })),
      })).filter((section) => section.items.length > 0),
    [navBySection]
  )

  return (
    <LiveOpsProvider>
      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sections={commandSections}
        characters={characters}
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
            {SECTION_ORDER.map((section) => {
              const items = navBySection[section]
              if (items.length === 0) return null
              return (
                <SidebarSection
                  key={section}
                  title={SECTION_TITLES[section]}
                  items={items}
                  storageKey={SECTION_STORAGE_KEYS[section]}
                  color={SECTION_COLORS[section]}
                  defaultOpen={section !== 'labs'}
                  badgeMap={section === 'govern' ? badgeCounts : undefined}
                />
              )
            })}
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
