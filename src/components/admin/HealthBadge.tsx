import { cn } from '@/lib/utils'
import { useLiveOps, type HealthStatus } from './LiveOpsContext'

/**
 * AP.20 — top-right health badge in the admin shell header. A 1-second
 * glance pixel: green (healthy), amber (warn), red (critical), grey
 * (unknown / loading). Tied to the same shared `LiveOpsContext` poller as
 * the AN.30 LiveOpsStrip so both stay in lockstep without double-fetching.
 *
 * Click target reserved for the AN.29 latency budget panel; until that
 * ships, the badge is a non-interactive `<span>` with a descriptive title.
 */
export function HealthBadge(): React.JSX.Element {
  const { status, data, error } = useLiveOps()

  const label = labelForStatus(status)
  const detail = describe(status, data, error)

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium tabular-nums"
      title={detail}
      aria-label={`Health: ${label}. ${detail}`}
      data-testid="health-badge"
      data-status={status}
    >
      <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', dotColor(status))} aria-hidden />
      <span className="text-muted-foreground/80">{label}</span>
    </span>
  )
}

function dotColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500'
    case 'warn':
      return 'bg-amber-500'
    case 'critical':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/40'
  }
}

function labelForStatus(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'OK'
    case 'warn':
      return 'WARN'
    case 'critical':
      return 'DOWN'
    default:
      return '—'
  }
}

function describe(
  status: HealthStatus,
  data: ReturnType<typeof useLiveOps>['data'],
  error: string | null,
): string {
  if (error) return `Live-ops error: ${error}`
  if (!data) return 'Loading live ops…'
  const errPct =
    data.errorRate == null ? 'n/a' : `${(data.errorRate * 100).toFixed(2)}% errors`
  return `${status.toUpperCase()} · ${data.games1h} games / ${data.errors1h} errors (last 1h) · ${errPct}`
}
