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

export default function App(): ReactElement {
  const platformAdapters = useMemo(() => createMobilePlatformAdapters(), [])
  const adapterNames = Object.keys(platformAdapters).join(' | ')
  const { state, dispatch, phaseTitle, phaseSubtitle } = useCoreGameFlow()

  const renderActions = (): ReactElement => {
    switch (state.phase) {
      case 'welcome':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'START_GAME' })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Start Game</Text>
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
              onPress={() => dispatch({ type: 'SHOW_GUESS' })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Reveal Guess</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'INCREMENT_GUESS_COUNT' })}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>+ Guess Count</Text>
            </Pressable>
          </View>
        )
      case 'guessing':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'END_GAME' })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Mark Correct</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'END_GAME', surrendered: true })}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Surrender</Text>
            </Pressable>
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
              <Text style={styles.primaryButtonText}>Back To Welcome</Text>
            </Pressable>
          </View>
        )
      case 'challenge':
        return (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'START_GAME' })}
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
        <Text style={styles.body}>
          {phaseSubtitle}
        </Text>
        <Text style={styles.caption}>
          Current phase key: {state.phase}
        </Text>
        <Text style={styles.caption}>
          Platform adapters: {adapterNames}
        </Text>
        <Text style={styles.caption}>
          Guess count: {state.guessCount} | Exhausted: {String(state.exhausted)} | Surrendered:{' '}
          {String(state.surrendered)}
        </Text>
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
