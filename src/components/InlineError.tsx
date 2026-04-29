import { motion } from 'motion/react'
import { WarningCircleIcon, ArrowClockwiseIcon, XIcon } from '@phosphor-icons/react'

interface InlineErrorProps {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
}

/**
 * A non-blocking, retry-affording inline alert. Used for transient
 * server/network errors that previously only surfaced as toasts.
 * Intentionally small footprint — fits inside the active game frame
 * without displacing the question.
 */
export function InlineError({
  message,
  onRetry,
  onDismiss,
  retryLabel = 'Retry',
}: Readonly<InlineErrorProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <WarningCircleIcon size={18} weight="fill" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-background/40 px-2 py-1 text-xs font-medium hover:bg-background/70 transition-colors"
        >
          <ArrowClockwiseIcon size={14} aria-hidden />
          {retryLabel}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 hover:bg-background/40 transition-colors"
        >
          <XIcon size={14} aria-hidden />
        </button>
      )}
    </motion.div>
  )
}
