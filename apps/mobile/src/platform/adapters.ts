import type {
  HapticsAdapter,
  LifecycleState,
  NetworkAdapter,
  NetworkRequestOptions,
  PlatformAdapters,
} from '@guess/app-core'
import { AppState, type AppStateStatus, Share } from 'react-native'

const mapToLifecycleState = (state: AppStateStatus): LifecycleState => {
  if (state === 'active' || state === 'inactive' || state === 'background') {
    return state
  }
  return 'unknown'
}

const createMobileStorageAdapter = () => {
  // Intentional placeholder until secure persistent storage is selected.
  const cache = new Map<string, string>()

  return {
    getItem: async (key: string): Promise<string | null> => cache.get(key) ?? null,
    setItem: async (key: string, value: string): Promise<void> => {
      cache.set(key, value)
    },
    removeItem: async (key: string): Promise<void> => {
      cache.delete(key)
    },
  }
}

const createMobileNetworkAdapter = (): NetworkAdapter => ({
  fetchJson: async <T>(url: string, options?: NetworkRequestOptions): Promise<T> => {
    const response = await fetch(url, {
      method: options?.method,
      headers: options?.headers,
      body: options?.body,
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    return (await response.json()) as T
  },
})

const createMobileShareAdapter = () => ({
  shareText: async (text: string, title?: string): Promise<boolean> => {
    const result = await Share.share({ message: text, title })
    return result.action !== Share.dismissedAction
  },
})

const createMobileHapticsAdapter = (): HapticsAdapter => ({
  trigger: async (style): Promise<void> => {
    void style
    // TODO: Wire to expo-haptics when interaction surfaces are implemented.
  },
})

const createMobileLifecycleAdapter = () => ({
  getCurrentState: (): LifecycleState => mapToLifecycleState(AppState.currentState),
  onAppStateChange: (listener: (state: LifecycleState) => void): (() => void) => {
    const subscription = AppState.addEventListener('change', (state) => {
      listener(mapToLifecycleState(state))
    })
    return () => {
      subscription.remove()
    }
  },
})

export const createMobilePlatformAdapters = (): PlatformAdapters => ({
  storage: createMobileStorageAdapter(),
  network: createMobileNetworkAdapter(),
  share: createMobileShareAdapter(),
  haptics: createMobileHapticsAdapter(),
  lifecycle: createMobileLifecycleAdapter(),
})
