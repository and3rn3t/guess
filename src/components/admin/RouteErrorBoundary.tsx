import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangleIcon, RefreshCwIcon, ClipboardCopyIcon, CheckIcon } from 'lucide-react'

interface FallbackProps {
  error: unknown
  resetErrorBoundary: () => void
}

const CHUNK_RELOAD_GUARD_KEY = 'admin:chunk-reload-attempted'

function isDynamicImportFetchError(message: string): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed/i.test(
    message,
  )
}

/**
 * Inline error card rendered when an admin route throws. Stays within the
 * `<Outlet />` slot so the sidebar and shell remain mounted and usable.
 *
 * Provides:
 *   - Retry button (re-mounts the failing route subtree by resetting the boundary)
 *   - Copy-to-clipboard for the error message + stack
 *   - Trimmed message preview (full stack in DEV)
 */
function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [copied, setCopied] = useState(false)
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const isDev = import.meta.env.DEV
  const isChunkLoadFailure = isDynamicImportFetchError(message)

  // Telemetry: report once per error instance, only in production builds.
  useEffect(() => {
    if (isDev) return
    void import('@/lib/analytics').then((m) => m.trackUncaughtError(message, stack))
  }, [message, stack, isDev])

  // Self-heal once when a deployed chunk hash has rotated under a stale shell.
  useEffect(() => {
    if (!isChunkLoadFailure) return
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === '1') return
      sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1')
      window.location.reload()
    } catch {
      // If sessionStorage is unavailable, avoid crashing the fallback.
    }
  }, [isChunkLoadFailure])

  const handleCopy = async () => {
    const payload = stack ? `${message}\n\n${stack}` : message
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied — fall back to no-op rather than crashing
      // the boundary itself.
    }
  }

  return (
    <div className="p-6">
      <Alert variant="destructive" className="mb-4">
        <AlertTriangleIcon />
        <AlertTitle>This route failed to render</AlertTitle>
        <AlertDescription>
          The rest of the admin panel is still usable. Retry to remount this route, or copy the
          error to share it.
        </AlertDescription>
      </Alert>

      <div className="bg-card border rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-sm text-muted-foreground mb-2">Error</h3>
        <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto max-h-48 whitespace-pre-wrap">
          {message}
          {isDev && stack ? `\n\n${stack}` : null}
        </pre>
      </div>

      <div className="flex gap-3">
        <Button onClick={resetErrorBoundary} variant="default" size="sm">
          <RefreshCwIcon />
          Retry
        </Button>
        {isChunkLoadFailure && (
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            <RefreshCwIcon />
            Reload page
          </Button>
        )}
        <Button onClick={handleCopy} variant="outline" size="sm">
          {copied ? <CheckIcon /> : <ClipboardCopyIcon />}
          {copied ? 'Copied' : 'Copy error'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Wraps the admin `<Outlet />`. Resets automatically when the route path
 * changes so navigating away from a failing route always shows fresh content
 * (instead of carrying the stale error across routes).
 */
export function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <ErrorBoundary
      // Resetting the key on path change forces a fresh boundary per route.
      resetKeys={[location.pathname]}
      FallbackComponent={RouteErrorFallback}
    >
      {children}
    </ErrorBoundary>
  )
}
