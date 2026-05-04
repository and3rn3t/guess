import { StatusBar } from 'expo-status-bar'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { createMobilePlatformAdapters } from './src/platform/adapters'
import { useCoreGameFlow } from './src/state/useCoreGameFlow'
import { useMobileServerGame } from './src/state/useMobileServerGame'

export default function App(): ReactElement {
  const platformAdapters = useMemo(() => createMobilePlatformAdapters(), [])
  const { state, dispatch, phaseTitle } = useCoreGameFlow()
  const server = useMobileServerGame(
    dispatch,
    platformAdapters.network,
    platformAdapters.haptics,
  )

  const renderActions = (): ReactElement => {
    switch (state.phase) {
      case 'welcome':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={server.isLoading}
              onPress={() => void server.startGame()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {server.isLoading ? 'Starting…' : 'Start Game'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'GO_TO_CHALLENGE' })}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Challenge</Text>
            </Pressable>
          </View>
        )
      case 'playing':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={server.isLoading}
              onPress={() => void server.submitAnswer('yes')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Yes</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={server.isLoading}
              onPress={() => void server.submitAnswer('no')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>No</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={server.isLoading}
              onPress={() => void server.skipQuestion()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>
          </View>
        )
      case 'guessing':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={server.isLoading}
              onPress={() => void server.confirmCorrect()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Correct!</Text>
            </Pressable>
            {server.guessCharacter && (
              <Pressable
                accessibilityRole="button"
                disabled={server.isLoading}
                onPress={() => void server.rejectGuess(server.guessCharacter!.id)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Not This One</Text>
              </Pressable>
            )}
          </View>
        )
      case 'gameOver':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'BACK_TO_WELCOME' })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Play Again</Text>
            </Pressable>
          </View>
        )
      case 'challenge':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={server.isLoading}
              onPress={() => void server.startGame()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Start Challenge</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'BACK_TO_WELCOME' })}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        )
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '700',
  },
})
