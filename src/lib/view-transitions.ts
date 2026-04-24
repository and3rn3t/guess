/**
 * View Transitions API helper.
 *
 * Wraps `document.startViewTransition` so callers don't need to feature-detect.
 * On unsupported browsers (Firefox, older Safari) the callback runs synchronously
 * and the result resolves to `null` — same observable behavior as without VTs.
 *
 * Pair with `prefers-reduced-motion: reduce` CSS overrides in `index.css` to
 * disable the cross-fade for users who request reduced motion.
 *
 * @example
 *   startViewTransition(() => setGamePhase('playing'))
 */

type ViewTransitionLike = {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => ViewTransitionLike
}

export function startViewTransition(callback: () => void): ViewTransitionLike | null {
  if (typeof document === 'undefined') {
    callback()
    return null
  }
  const doc = document as DocWithVT
  if (typeof doc.startViewTransition !== 'function') {
    callback()
    return null
  }
  try {
    return doc.startViewTransition(callback)
  } catch {
    // Defensive: spec allows the API to throw under specific timing edge cases
    callback()
    return null
  }
}
