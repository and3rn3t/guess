import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface GameOverScreenProps {
  exhausted: boolean;
  surrendered: boolean;
  isBusy: boolean;
  onBackToWelcome: () => void;
  onOpenFeedback: () => void;
  onOpenStats: () => void;
}

export function GameOverScreen({
  exhausted,
  surrendered,
  isBusy,
  onBackToWelcome,
  onOpenFeedback,
  onOpenStats
}: Readonly<GameOverScreenProps>): ReactElement {
  let outcome = 'Run complete. Ready for another round.';
  if (exhausted) {
    outcome = 'No more valid branches remain for this run.';
  } else if (surrendered) {
    outcome = 'You surrendered this run.';
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>GAME OVER</Text>
        <Text style={styles.title}>Session Complete</Text>
        <Text style={styles.subtitle}>{outcome}</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Outcome Flags</Text>
        <Text style={styles.summaryText}>Exhausted: {exhausted ? 'yes' : 'no'}</Text>
        <Text style={styles.summaryText}>Surrendered: {surrendered ? 'yes' : 'no'}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to welcome"
        disabled={isBusy}
        onPress={onBackToWelcome}
        style={[styles.actionButton, styles.actionPrimary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionPrimaryText}>Back To Welcome</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open feedback"
        disabled={isBusy}
        onPress={onOpenFeedback}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Open Feedback</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open stats"
        disabled={isBusy}
        onPress={onOpenStats}
        style={[styles.actionButton, styles.actionGhost, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionGhostText}>Open Stats</Text>
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
    backgroundColor: '#fdba74',
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
  summaryCard: {
    borderWidth: 1,
    borderColor: '#7c2d12',
    borderRadius: 14,
    backgroundColor: '#431407',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  summaryLabel: {
    color: '#fdba74',
    fontSize: 13,
    fontWeight: '700'
  },
  summaryText: {
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
