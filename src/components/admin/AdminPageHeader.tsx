import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

type SectionColor = 'blue' | 'violet' | 'amber' | 'emerald'

const ICON_COLOR_MAP: Record<SectionColor, string> = {
  blue: 'text-blue-400',
  violet: 'text-violet-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
}

interface Breadcrumb {
  label: string
  to?: string
}

interface AdminPageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: Breadcrumb[]
  sectionColor?: SectionColor
}

export function AdminPageHeader({
  title,
  subtitle,
  icon,
  actions,
  breadcrumbs,
  sectionColor,
}: AdminPageHeaderProps): React.JSX.Element {
  const iconColorClass = sectionColor ? ICON_COLOR_MAP[sectionColor] : 'text-muted-foreground'

  return (
    <div className="border-b border-border/40 py-5 mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            {breadcrumbs.map((crumb, i) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className={cn('shrink-0', iconColorClass)}>
              {icon}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
