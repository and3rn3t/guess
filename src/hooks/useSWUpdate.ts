import { useEffect, useState } from 'react'

/**
 * Listens for a `SW_UPDATED` postMessage from the service worker (sent on
 * activate) and returns a flag so the app can prompt the user to reload.
 */
export function useSWUpdate(): { updateAvailable: boolean; reload: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setUpdateAvailable(true)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  const reload = () => window.location.reload()

  return { updateAvailable, reload }
}
