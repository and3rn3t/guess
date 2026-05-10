import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface WelcomeScreenProps {
  isBusy: boolean;
  isOffline: boolean;
  lastError: string | null;
  hasSavedSession: boolean;
  quickStartSummary: string;
  teachingProgressSummary: string;
  onStartGame: () => void;
  onOpenChallenge: () => void;
  onOpenTeaching: () => void;
  onOpenResume: () => void;
}

export function WelcomeScreen({
  isBusy,
  isOffline,
  lastError,
  hasSavedSession,
  quickStartSummary,
  teachingProgressSummary,
  onStartGame,
  onOpenChallenge,
  onOpenTeaching,
  onOpenResume
}: Readonly<WelcomeScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>WELCOME</Text>
        <Text style={styles.title}>Think Of A Character</Text>
        <Text style={styles.subtitle}>Answer strategic questions and let the game deduce your pick.</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Quick Start</Text>
        <Text style={styles.heroBody}>{quickStartSummary}</Text>
        <Text style={styles.heroSubtle}>{teachingProgressSummary}</Text>
      </View>

      {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}

      {isOffline && !lastError ? (
        <Text style={styles.offlineHint}>You're offline — starting a game requires a connection.</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || isOffline}
        onPress={onStartGame}
        style={[styles.actionButton, styles.actionPrimary, isBusy || isOffline ? styles.disabled : null]}
      >
        <Text style={styles.actionPrimaryText}>Start Game</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onOpenChallenge}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Open Challenge</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onOpenTeaching}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Open Teaching</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || !hasSavedSession}
        onPress={onOpenResume}
        style={[
          styles.actionButton,
          styles.actionGhost,
          isBusy || !hasSavedSession ? styles.disabled : null
        ]}
      >
        <Text style={styles.actionGhostText}>
          {hasSavedSession ? 'Open Session Resume' : 'No Saved Session'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 14
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#102a43',
    backgroundColor: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#164e63',
    borderRadius: 14,
    backgroundColor: '#082f49',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  heroTitle: {
    color: '#bae6fd',
    fontSize: 13,
    fontWeight: '700'
  },
  heroBody: {
    color: '#e0f2fe',
    fontSize: 14,
    lineHeight: 20
  },
  heroSubtle: {
    color: '#a5f3fc',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600'
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  offlineHint: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionPrimary: {
    backgroundColor: '#22c55e'
  },
  actionSecondary: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionGhost: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151'
  },
  actionPrimaryText: {
    color: '#052e16',
    fontSize: 15,
    fontWeight: '700'
  },
  actionSecondaryText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700'
  },
  actionGhostText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.5
  }
});
