/**
 * `requestIdleCallback` wrapper with a setTimeout fallback for Safari
 * (which still ships without the API as of 2026).
 *
 * Use for non-critical writes — analytics flushes, IndexedDB persistence,
 * fire-and-forget POSTs — so they don't compete with user interactions
 * for the main thread.
 *
 * The `timeout` ensures the callback eventually fires even on a busy page.
 */

type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number }
type IdleCallback = (deadline: IdleDeadline) => void

type WindowWithIdle = Window & {
  requestIdleCallback?: (cb: IdleCallback, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export function runWhenIdle(callback: () => void, timeout = 2000): () => void {
  if (typeof globalThis.window === 'undefined') {
    callback()
    return () => {}
  }
  const w = globalThis.window as WindowWithIdle
  if (typeof w.requestIdleCallback === 'function') {
    const handle = w.requestIdleCallback(() => callback(), { timeout })
    return () => w.cancelIdleCallback?.(handle)
  }
  const handle = setTimeout(callback, 0)
  return () => clearTimeout(handle)
}
