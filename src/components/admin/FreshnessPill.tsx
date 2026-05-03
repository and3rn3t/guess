import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const STALE_WARN_MS = 5 * 60 * 1000
const STALE_CRITICAL_MS = 30 * 60 * 1000

interface FreshnessPillProps {
  fetchedAt: number | null | undefined
  onRefresh: () => void
  refreshing?: boolean
  className?: string
}

function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function FreshnessPill({
  fetchedAt,
  onRefresh,
  refreshing = false,
  className,
}: Readonly<FreshnessPillProps>): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = globalThis.setInterval(() => setNow(Date.now()), 30_000)
    return () => globalThis.clearInterval(id)
  }, [])

  const ageMs = useMemo(() => {
    if (!fetchedAt) return null
    return Math.max(0, now - fetchedAt)
  }, [fetchedAt, now])

  const toneClass =
    ageMs == null
      ? 'border-border/60 text-muted-foreground hover:bg-muted/30'
      : ageMs > STALE_CRITICAL_MS
        ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
        : ageMs > STALE_WARN_MS
          ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
          : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'

  const label = ageMs == null ? 'Fetch now' : `Fetched ${formatAge(ageMs)} ago`

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
        toneClass,
        className,
      )}
      title={label}
      aria-label={`${label}. Click to refresh.`}
    >
      <ArrowsClockwiseIcon size={12} className={refreshing ? 'animate-spin' : undefined} />
      {label}
    </button>
  )
}
