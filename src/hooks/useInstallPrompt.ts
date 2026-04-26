import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallPrompt {
  /** true when the browser has deferred an install prompt */
  canInstall: boolean
  /** Call to show the native install dialog */
  promptInstall: () => Promise<void>
}

/**
 * Captures the `beforeinstallprompt` event and exposes a `promptInstall`
 * handler so the app can show its own install CTA at the right moment.
 *
 * Works on Chrome/Edge/Samsung Internet; silently no-ops on Safari/Firefox.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    // Clear after the app is installed
    const onInstalled = () => setDeferred(null)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return { canInstall: deferred !== null, promptInstall }
}
