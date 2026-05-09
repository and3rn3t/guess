import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface GuessingScreenProps {
  characterName: string;
  characterCategory: string;
  confidence: number | null;
  guessCount: number;
  isBusy: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onReject: () => void;
  onSurrender: () => void;
}

export function GuessingScreen({
  characterName,
  characterCategory,
  confidence,
  guessCount,
  isBusy,
  errorMessage,
  onConfirm,
  onReject,
  onSurrender
}: Readonly<GuessingScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>GUESSING</Text>
        <Text style={styles.title}>
          {guessCount > 0 ? `Guess #${guessCount + 1}` : 'Final Candidate Ready'}
        </Text>
        <Text style={styles.subtitle}>Confirm if this is correct, or reject and keep searching.</Text>
      </View>

      <View style={styles.guessCard}>
        <Text style={styles.guessLabel}>{guessCount > 0 ? `Attempt ${guessCount + 1}` : 'Current Guess'}</Text>
        <Text style={styles.guessName}>{characterName}</Text>
        <Text style={styles.guessMeta}>Category: {characterCategory}</Text>
        <Text style={styles.guessMeta}>Confidence: {confidence ?? 'n/a'}</Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onConfirm}
        style={[styles.actionButton, styles.actionPrimary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionPrimaryText}>Yes, Correct Guess</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onReject}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>No, Keep Going</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onSurrender}
        style={[styles.actionButton, styles.actionGhost, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionGhostText}>Surrender</Text>
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
    backgroundColor: '#fef08a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22
  },
  guessCard: {
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 14,
    backgroundColor: '#052e16',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6
  },
  guessLabel: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '700'
  },
  guessName: {
    color: '#f0fdf4',
    fontSize: 22,
    fontWeight: '800'
  },
  guessMeta: {
    color: '#86efac',
    fontSize: 13,
    fontWeight: '600'
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
