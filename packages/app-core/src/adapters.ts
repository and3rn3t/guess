export type HapticFeedbackStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'

export type LifecycleState = 'active' | 'inactive' | 'background' | 'unknown'

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export interface NetworkRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

export interface NetworkAdapter {
  fetchJson<T>(url: string, options?: NetworkRequestOptions): Promise<T>
}

export interface ShareAdapter {
  shareText(text: string, title?: string): Promise<boolean>
}

export interface HapticsAdapter {
  trigger(style: HapticFeedbackStyle): Promise<void>
}

export interface LifecycleAdapter {
  getCurrentState(): LifecycleState
  onAppStateChange(listener: (state: LifecycleState) => void): () => void
}

export interface PlatformAdapters {
  storage: StorageAdapter
  network: NetworkAdapter
  share: ShareAdapter
  haptics: HapticsAdapter
  lifecycle: LifecycleAdapter
}

export const createNoopPlatformAdapters = (): PlatformAdapters => ({
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
  network: {
    fetchJson: async <T>() => ({} as T),
  },
  share: {
    shareText: async () => false,
  },
  haptics: {
    trigger: async (style) => {
      void style
    },
  },
  lifecycle: {
    getCurrentState: () => 'unknown',
    onAppStateChange: () => () => {},
  },
})
