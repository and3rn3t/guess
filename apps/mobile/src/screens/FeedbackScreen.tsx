import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface FeedbackScreenProps {
  isBusy: boolean;
  onBackToWelcome: () => void;
  onStartNewGame: () => void;
}

export function FeedbackScreen({
  isBusy,
  onBackToWelcome,
  onStartNewGame
}: Readonly<FeedbackScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>FEEDBACK</Text>
        <Text style={styles.title}>How Was This Round?</Text>
        <Text style={styles.subtitle}>
          Post-game feedback flow is now a dedicated surface and ready for rating transport wiring.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Current Scope</Text>
        <Text style={styles.infoBody}>Rating submission endpoint hookup will be added in a follow-up slice.</Text>
      </View>

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
        onPress={onStartNewGame}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Start New Game</Text>
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
    backgroundColor: '#fed7aa',
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
    borderColor: '#9a3412',
    borderRadius: 14,
    backgroundColor: '#431407',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  infoTitle: {
    color: '#fdba74',
    fontSize: 13,
    fontWeight: '700'
  },
  infoBody: {
    color: '#ffedd5',
    fontSize: 14,
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
