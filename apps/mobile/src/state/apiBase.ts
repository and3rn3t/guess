import Constants from 'expo-constants'
import { NativeModules } from 'react-native'

export const resolveApiBase = (): string => {
  const explicitBase =
    typeof process !== 'undefined' &&
    typeof process.env.EXPO_PUBLIC_API_BASE_URL === 'string'
      ? process.env.EXPO_PUBLIC_API_BASE_URL.trim()
      : ''

  if (explicitBase.length > 0) {
    return explicitBase
  }

  const runtimeConfigBase =
    (Constants.expoConfig as { extra?: { apiBaseUrl?: string } } | null)?.extra?.apiBaseUrl ??
    (Constants as {
      manifest?: { extra?: { apiBaseUrl?: string } }
      manifest2?: { extra?: { apiBaseUrl?: string } }
    }).manifest?.extra?.apiBaseUrl ??
    (Constants as {
      manifest2?: { extra?: { apiBaseUrl?: string } }
    }).manifest2?.extra?.apiBaseUrl ??
    ''

  if (runtimeConfigBase.trim().length > 0) {
    return runtimeConfigBase.trim()
  }

  if (__DEV__) {
    const hostFromValue = (value: string | undefined): string | null => {
      if (!value || value.length === 0) {
        return null
      }

      const trimmed = value.trim()
      try {
        const host = new URL(trimmed).hostname
        if (host.length > 0) {
          return host
        }
      } catch {
        // Some Expo host strings are host:port without URL scheme.
      }

      const [hostWithMaybePath] = trimmed.split('/')
      const [host] = hostWithMaybePath.split(':')
      return host.length > 0 ? host : null
    }

    const scriptUrl = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL
    const expoHostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri
    const manifestDebuggerHost = (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost
    const manifest2DebuggerHost = (Constants as {
      manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } }
    }).manifest2?.extra?.expoGo?.debuggerHost

    const metroHost =
      hostFromValue(scriptUrl) ??
      hostFromValue(expoHostUri) ??
      hostFromValue(manifestDebuggerHost) ??
      hostFromValue(manifest2DebuggerHost)

    if (metroHost) {
      return `http://${metroHost}:8788`
    }
  }

  return ''
}

export const requireApiBase = (): string => {
  const base = resolveApiBase()
  if (base.length > 0) {
    return base
  }

  throw new Error(
    'API base URL is unavailable. Set EXPO_PUBLIC_API_BASE_URL or ensure Metro host resolution is available in debug.',
  )
}

export const endpoint = (path: string): string => `${requireApiBase()}${path}`