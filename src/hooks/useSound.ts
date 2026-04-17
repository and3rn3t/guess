import { useCallback, useSyncExternalStore } from 'react'
import { isMuted, toggleMute, setMuted } from '@/lib/sounds'

const STORAGE_KEY = 'kv:sound-muted'

let listeners: Array<() => void> = []

function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): boolean {
  return isMuted()
}

/** Hook that syncs sound mute state with localStorage. */
export function useSound() {
  const muted = useSyncExternalStore(subscribe, getSnapshot)

  // Restore on first render
  // (useSound is called once in App, so this initializes early)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const shouldMute = stored === 'true'
      if (shouldMute !== isMuted()) {
        setMuted(shouldMute)
      }
    }
  }

  const toggle = useCallback(() => {
    const nowMuted = toggleMute()
    localStorage.setItem(STORAGE_KEY, String(nowMuted))
    listeners.forEach((l) => l())
    return nowMuted
  }, [])

  return { muted, toggle }
}
