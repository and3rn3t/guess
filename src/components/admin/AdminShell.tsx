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
} from '@phosphor-icons/react'
import { useAdminData } from './AdminDataContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const TOOL_ITEMS: NavItem[] = [
  { to: 'coverage', label: 'Attribute Coverage', icon: <ChartBarIcon size={16} weight="duotone" /> },
  { to: 'hygiene', label: 'Data Hygiene', icon: <WrenchIcon size={16} weight="duotone" /> },
  { to: 'cost', label: 'Cost Dashboard', icon: <ChartLineIcon size={16} weight="duotone" /> },
  { to: 'stress-test', label: 'Stress Test', icon: <TargetIcon size={16} weight="duotone" /> },
  { to: 'recommender', label: 'Attr Recommender', icon: <LightningIcon size={16} weight="duotone" /> },
  { to: 'category-recommender', label: 'Category Recommender', icon: <TreeStructureIcon size={16} weight="duotone" /> },
  { to: 'env', label: 'Environment Test', icon: <FlaskIcon size={16} weight="duotone" /> },
  { to: 'bulk-habitat', label: 'Bulk Habitat', icon: <ArrowsClockwiseIcon size={16} weight="duotone" /> },
  { to: 'demo', label: 'Question Gen Demo', icon: <BugIcon size={16} weight="duotone" /> },
]

const DATA_ITEMS: NavItem[] = [
  { to: 'characters', label: 'Characters', icon: <UsersIcon size={16} weight="duotone" /> },
  { to: 'questions', label: 'Questions', icon: <ListChecksIcon size={16} weight="duotone" /> },
  { to: 'enrichment', label: 'Enrichment Status', icon: <ArrowsClockwiseIcon size={16} weight="duotone" /> },
  { to: 'pipeline', label: 'Pipeline Log', icon: <TreeStructureIcon size={16} weight="duotone" /> },
  { to: 'analytics', label: 'Analytics', icon: <ChartBarIcon size={16} weight="duotone" /> },
  { to: 'confusion', label: 'Confusion Matrix', icon: <GridFourIcon size={16} weight="duotone" /> },
  { to: 'matrix', label: 'DNA Matrix', icon: <DnaIcon size={16} weight="duotone" /> },
]

const PIPELINE_ITEMS: NavItem[] = [
  { to: 'enrich', label: 'Live Enrichment', icon: <LightningIcon size={16} weight="duotone" /> },
  { to: 'proposed-attrs', label: 'Proposed Attributes', icon: <QueueIcon size={16} weight="duotone" /> },
  { to: 'disputes', label: 'Attribute Disputes', icon: <WarningOctagonIcon size={16} weight="duotone" /> },
  { to: 'community', label: 'Community Queue', icon: <UsersThreeIcon size={16} weight="duotone" /> },
  { to: 'error-logs', label: 'Error Logs', icon: <WarningOctagonIcon size={16} weight="fill" /> },
]

function SidebarSection({
  title,
  items,
}: {
  title: string
  items: NavItem[]
}): React.JSX.Element {
  return (
    <div className="mb-6">
      <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent/20 text-accent font-medium'
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
    </div>
  )
}

export function AdminShell(): React.JSX.Element {
  const { characterLimit, setCharacterLimit, characters, loading } = useAdminData()

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border/60 flex flex-col py-4 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-2 px-3 mb-6">
          <HouseIcon size={18} weight="duotone" className="text-accent" />
          <NavLink
            to="."
            end
            className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
          >
            Admin
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <SidebarSection title="Tools" items={TOOL_ITEMS} />
          <SidebarSection title="Data" items={DATA_ITEMS} />
          <SidebarSection title="Pipeline" items={PIPELINE_ITEMS} />
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
