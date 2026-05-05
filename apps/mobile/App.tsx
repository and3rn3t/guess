import { StatusBar } from 'expo-status-bar'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { createMobilePlatformAdapters } from './src/platform/adapters'
import { NativeServicesDebugMenu } from './src/native/NativeServicesDebugMenu'
import { ChallengeScreen } from './src/screens/ChallengeScreen'
import { GameOverScreen } from './src/screens/GameOverScreen'
import { GuessingScreen } from './src/screens/GuessingScreen'
import { PlayingScreen } from './src/screens/PlayingScreen'
import { WelcomeScreen } from './src/screens/WelcomeScreen'
import { useVoiceOver } from './src/native/useNativeServices'
import { useCoreGameFlow } from './src/state/useCoreGameFlow'
import { useMobileServerGame } from './src/state/useMobileServerGame'

export default function App(): ReactElement {
  const platformAdapters = useMemo(() => createMobilePlatformAdapters(), [])
  const { state, dispatch, phaseTitle } = useCoreGameFlow()
  const { announce, announceScreenChange } = useVoiceOver()
  const lastAnnouncedPhase = useRef(state.phase)
  const server = useMobileServerGame(
    dispatch,
    platformAdapters.network,
    platformAdapters.haptics,
  )

  useEffect(() => {
    if (lastAnnouncedPhase.current === state.phase) {
      return
    }

    lastAnnouncedPhase.current = state.phase
    void announceScreenChange(phaseTitle)
  }, [announceScreenChange, phaseTitle, state.phase])

  useEffect(() => {
    const cue = server.accessibilityCue
    if (!cue) {
      return
    }

    void announce(cue.message, cue.priority)
  }, [announce, server.accessibilityCue])

  const renderActions = (): ReactElement => {
    switch (state.phase) {
      case 'welcome':
        return <WelcomeScreen dispatch={dispatch} state={state} server={server} />
      case 'playing':
        return <PlayingScreen dispatch={dispatch} state={state} server={server} />
      case 'guessing':
        return <GuessingScreen dispatch={dispatch} state={state} server={server} />
      case 'gameOver':
        return <GameOverScreen dispatch={dispatch} state={state} server={server} />
      case 'challenge':
        return <ChallengeScreen dispatch={dispatch} state={state} server={server} />
      default:
        return <View />
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>iOS Native Preview</Text>
        <Text style={styles.title}>{phaseTitle}</Text>
        {server.question && (
          <Text style={styles.body}>{server.question.text}</Text>
        )}
        {server.alertMessage && (
          <Text style={styles.alert} onPress={server.clearAlert}>
            {server.alertMessage}
          </Text>
        )}
        {server.error && (
          <Text style={styles.errorText} onPress={server.clearError}>
            Error: {server.error}
          </Text>
        )}
        <Text style={styles.caption}>
          Phase: {state.phase} | Remaining: {server.remaining} | Session:{' '}
          {server.sessionId ? server.sessionId.slice(0, 8) + '…' : 'none'}
        </Text>
        {server.guessCharacter && state.phase === 'guessing' && (
          <Text style={styles.caption}>
            Guess: {server.guessCharacter.name} ({server.guessCharacter.category})
          </Text>
        )}
        {renderActions()}
      </View>
      <NativeServicesDebugMenu />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b1220',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#111b30',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2a44',
    gap: 10,
  },
  eyebrow: {
    color: '#86a3ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  body: {
    color: '#c7d2fe',
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 18,
  },
  alert: {
    color: '#fbbf24',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 18,
  },
})
