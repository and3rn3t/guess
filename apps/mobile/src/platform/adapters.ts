import type {
  HapticsAdapter,
  LifecycleState,
  NetworkAdapter,
  NetworkRequestOptions,
  PlatformAdapters,
} from '@guess/app-core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { AppState, type AppStateStatus, Share } from 'react-native'

const mapToLifecycleState = (state: AppStateStatus): LifecycleState => {
  if (state === 'active' || state === 'inactive' || state === 'background') {
    return state
  }
  return 'unknown'
}

const createMobileStorageAdapter = () => {
  const fallbackCache = new Map<string, string>()

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const persisted = await AsyncStorage.getItem(key)
        if (persisted !== null) {
          fallbackCache.set(key, persisted)
          return persisted
        }
      } catch {
        // Ignore storage-layer failures and fall back to in-memory cache.
      }
      return fallbackCache.get(key) ?? null
    },
    setItem: async (key: string, value: string): Promise<void> => {
      fallbackCache.set(key, value)
      try {
        await AsyncStorage.setItem(key, value)
      } catch {
        // Ignore storage-layer failures and retain in-memory value.
      }
    },
    removeItem: async (key: string): Promise<void> => {
      fallbackCache.delete(key)
      try {
        await AsyncStorage.removeItem(key)
      } catch {
        // Ignore storage-layer failures.
      }
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
    if (style === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      return
    }
    if (style === 'medium') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      return
    }
    if (style === 'heavy') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      return
    }
    if (style === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return
    }
    if (style === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
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
