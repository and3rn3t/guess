import { useEffect } from 'react'

/**
 * Holds a screen wake lock while `active` is true, preventing the device
 * from dimming or locking during gameplay.
 *
 * Per the Wake Lock API spec, locks are automatically released when the
 * tab becomes hidden, so we re-acquire on `visibilitychange` whenever the
 * tab returns to the foreground while still active.
 *
 * Silently no-ops on browsers without `navigator.wakeLock` (Firefox,
 * older Safari).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined') return
    const nav = navigator as NavigatorWithWakeLock
    const wakeLock = nav.wakeLock
    if (!wakeLock?.request) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.hidden) return
      try {
        const lock = await wakeLock.request('screen')
        if (cancelled) {
          void lock.release().catch(() => {})
          return
        }
        sentinel = lock
      } catch {
        // User denied / unsupported / battery saver — no-op
      }
    }

    const onVisibility = () => {
      if (!document.hidden && (!sentinel || sentinel.released)) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {})
      }
    }
  }, [active])
}
