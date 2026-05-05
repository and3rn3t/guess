/**
 * Root layout — Expo Router entry point.
 *
 * Wraps the entire app in GameProvider so all routes share game state.
 * Drives navigation via router.replace() based on state.phase changes.
 * Handles VoiceOver screen-change announcements at the layout level.
 */
import { Stack, useRouter } from 'expo-router'
import type { ReactElement } from 'react'
import { useEffect, useRef } from 'react'
import { useVoiceOver } from '../src/native/useNativeServices'
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
  const lastPhase = useRef(state.phase)

  useEffect(() => {
    if (lastPhase.current === state.phase) return
    lastPhase.current = state.phase
    const route = PHASE_ROUTES[state.phase]
    router.replace(route as Parameters<typeof router.replace>[0])
    void announceScreenChange(phaseTitle)
  }, [state.phase, phaseTitle, router, announceScreenChange])

  useEffect(() => {
    const cue = server.accessibilityCue
    if (!cue) return
    void announce(cue.message, cue.priority)
  }, [announce, server.accessibilityCue])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  )
}

export default function RootLayout(): ReactElement {
  return (
    <GameProvider>
      <PhaseNavigator />
    </GameProvider>
  )
}
