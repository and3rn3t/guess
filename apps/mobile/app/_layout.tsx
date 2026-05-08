/**
 * Root layout — Expo Router entry point.
 *
 * Wraps the entire app in GameProvider so all routes share game state.
 * Drives navigation via router.replace() based on state.phase changes.
 * Handles VoiceOver screen-change announcements at the layout level.
 */
import { Stack, useRouter } from 'expo-router'
import type { ErrorInfo, ReactElement, ReactNode } from 'react'
import { Component, useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import { NativeServicesDebugMenu } from '../src/native/NativeServicesDebugMenu'
import { useLifecycle, useReduceMotion, useVoiceOver } from '../src/native/useNativeServices'
import { GameProvider, useGame } from '../src/state/GameContext'

const PHASE_ROUTES = {
  welcome: '/',
  playing: '/playing',
  guessing: '/guessing',
  gameOver: '/game-over',
  challenge: '/challenge',
} as const

function PhaseNavigator(): ReactElement {
  const router = useRouter()
  const { state, phaseTitle, server } = useGame()
  const { announce, announceScreenChange } = useVoiceOver()
  const reduceMotion = useReduceMotion()
  const lifecycle = useLifecycle()
  const lastPhase = useRef<keyof typeof PHASE_ROUTES | null>(null)
  const lastLifecycle = useRef(lifecycle)

  useEffect(() => {
    if (lastPhase.current === state.phase) return
    const previousPhase = lastPhase.current
    lastPhase.current = state.phase
    if (previousPhase !== null) {
      const route = PHASE_ROUTES[state.phase]
      router.replace(route as Parameters<typeof router.replace>[0])
    }
    void announceScreenChange(phaseTitle)
  }, [state.phase, phaseTitle, router, announceScreenChange])

  useEffect(() => {
    const cue = server.accessibilityCue
    if (!cue) return
    void announce(cue.message, cue.priority)
  }, [announce, server.accessibilityCue])

  useEffect(() => {
    const wasBackgrounded =
      lastLifecycle.current === 'background' || lastLifecycle.current === 'inactive'
    lastLifecycle.current = lifecycle
    if (!wasBackgrounded || lifecycle !== 'active') {
      return
    }
    void announce(`Resumed. ${phaseTitle}.`, 'high')
  }, [announce, lifecycle, phaseTitle])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  )
}

class DiagnosticErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log full details to the native console so they appear in Xcode's device log.
    console.error('[DiagnosticErrorBoundary] caught error:', error.message)
    console.error('[DiagnosticErrorBoundary] stack:', error.stack ?? '(no stack)')
    console.error('[DiagnosticErrorBoundary] component stack:', info.componentStack ?? '(none)')
  }

  render() {
    if (this.state.error) {
      const message = __DEV__
        ? `[DiagnosticErrorBoundary]\n${this.state.error.message}\n\n${this.state.error.stack ?? ''}`
        : 'Something went wrong. Please restart the app.'
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 14, color: 'red', textAlign: 'center' }}>{message}</Text>
        </View>
      )
    }
    return this.props.children
  }
}

export default function RootLayout(): ReactElement {
  return (
    <DiagnosticErrorBoundary>
      <GameProvider>
        <PhaseNavigator />
        <NativeServicesDebugMenu />
      </GameProvider>
    </DiagnosticErrorBoundary>
  )
}

/**
 * Expo Router ErrorBoundary — called when the root layout itself throws
 * before React can mount. Logs details to the native console.
 */
export function ErrorBoundary({ error }: { error: Error }) {
  console.error('[ExpoRouter ErrorBoundary] message:', error.message)
  console.error('[ExpoRouter ErrorBoundary] stack:', error.stack ?? '(no stack)')
  const message = __DEV__
    ? `[ExpoRouter ErrorBoundary]\n${error.message}\n\n${error.stack ?? ''}`
    : 'Something went wrong. Please restart the app.'
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 14, color: 'red', textAlign: 'center' }}>{message}</Text>
    </View>
  )
}
