import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ChallengeScreenProps {
  isBusy: boolean;
  errorMessage: string | null;
  onBackToWelcome: () => void;
  onOpenHistory: () => void;
}

export function ChallengeScreen({
  isBusy,
  errorMessage,
  onBackToWelcome,
  onOpenHistory
}: Readonly<ChallengeScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>CHALLENGE</Text>
        <Text style={styles.title}>Daily Challenge</Text>
        <Text style={styles.subtitle}>
          Challenge now has a dedicated shell and is ready for daily status and leaderboard transport wiring.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Current Scope</Text>
        <Text style={styles.infoBody}>Summary-first challenge presentation with direct navigation to history.</Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onBackToWelcome}
        style={[styles.actionButton, styles.actionPrimary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionPrimaryText}>Back To Welcome</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onOpenHistory}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Open History</Text>
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
    color: '#2f1b0c',
    backgroundColor: '#fde68a',
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
  infoCard: {
    borderWidth: 1,
    borderColor: '#713f12',
    borderRadius: 14,
    backgroundColor: '#422006',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  infoTitle: {
    color: '#fde68a',
    fontSize: 13,
    fontWeight: '700'
  },
  infoBody: {
    color: '#fef3c7',
    fontSize: 14,
    lineHeight: 20
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
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
  disabled: {
    opacity: 0.5
  }
});
