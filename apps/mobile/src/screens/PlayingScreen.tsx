import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AnswerValue } from '../network/mobileGameApi';
import { SyncStatusBadge } from './SyncStatusBadge';

interface PlayingScreenProps {
  questionText: string;
  reasoningText: string | null;
  confidence: number | null;
  guessCount: number;
  rejectCooldownRemaining: number | null;
  isBusy: boolean;
  errorMessage: string | null;
  onAnswer: (value: AnswerValue) => void;
  onSkip: () => void;
  onEndGame: () => void;
}

export function PlayingScreen({
  questionText,
  reasoningText,
  confidence,
  guessCount,
  rejectCooldownRemaining,
  isBusy,
  errorMessage,
  onAnswer,
  onSkip,
  onEndGame
}: Readonly<PlayingScreenProps>): ReactElement {
  const answerButtons: ReadonlyArray<{ label: string; value: AnswerValue; tone?: 'primary' | 'secondary' }> = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
    { label: 'Maybe', value: 'maybe' },
    { label: 'Unknown', value: 'unknown', tone: 'secondary' }
  ];

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>PLAYING</Text>
        {guessCount > 0 && (
          <View style={styles.attemptBadge}>
            <Text style={styles.attemptBadgeText}>Guess attempt #{guessCount + 1}</Text>
          </View>
        )}
        <Text style={styles.title}>Ask The Next Best Question</Text>
        <Text style={styles.subtitle}>Answer quickly and keep the deduction loop moving.</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionLabel}>Current Question</Text>
        <Text style={styles.questionText}>{questionText}</Text>
        {reasoningText ? <Text style={styles.reasoningText}>{reasoningText}</Text> : null}
        <Text style={styles.metaText}>Confidence: {confidence ?? 'n/a'}</Text>
            {rejectCooldownRemaining !== null && rejectCooldownRemaining > 0 && (
              <View style={styles.cooldownCard}>
                <Text style={styles.cooldownText}>
                  Next guess available in {rejectCooldownRemaining} more {rejectCooldownRemaining === 1 ? 'question' : 'questions'}
                </Text>
              </View>
            )}

      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

  <SyncStatusBadge />

      <View style={styles.answerGrid}>
        {answerButtons.map((entry) => {
          const primary = entry.tone !== 'secondary';
          return (
            <Pressable
              accessibilityRole="button"
              key={entry.value}
              disabled={isBusy}
              onPress={() => onAnswer(entry.value)}
              style={[
                styles.answerButton,
                primary ? styles.answerButtonPrimary : styles.answerButtonSecondary,
                isBusy ? styles.answerButtonDisabled : null
              ]}
            >
              <Text
                style={[
                  styles.answerButtonText,
                  primary ? styles.answerButtonTextPrimary : styles.answerButtonTextSecondary
                ]}
              >
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onSkip}
          style={[styles.footerButton, styles.footerButtonSecondary, isBusy ? styles.answerButtonDisabled : null]}
        >
          <Text style={styles.footerButtonTextSecondary}>Skip Question</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onEndGame}
          style={[styles.footerButton, styles.footerButtonGhost, isBusy ? styles.answerButtonDisabled : null]}
        >
          <Text style={styles.footerButtonTextGhost}>End Game</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 18
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    backgroundColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  attemptBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  attemptBadgeText: {
    color: '#ede9fe',
    fontSize: 11,
    fontWeight: '700'
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
  questionCard: {
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: '#0b1c44'
  },
  cooldownCard: {
    borderRadius: 10,
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#44403c',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  cooldownText: {
    color: '#a8a29e',
    fontSize: 13,
    lineHeight: 18
  },
  questionLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '700'
  },
  questionText: {
    color: '#eff6ff',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700'
  },
  reasoningText: {
    color: '#dbeafe',
    fontSize: 13,
    lineHeight: 19
  },
  metaText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600'
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  answerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  answerButton: {
    minWidth: '47%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  answerButtonPrimary: {
    backgroundColor: '#22c55e'
  },
  answerButtonSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  answerButtonDisabled: {
    opacity: 0.5
  },
  answerButtonText: {
    fontSize: 15,
    fontWeight: '700'
  },
  answerButtonTextPrimary: {
    color: '#052e16'
  },
  answerButtonTextSecondary: {
    color: '#e2e8f0'
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10
  },
  footerButton: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  footerButtonSecondary: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155'
  },
  footerButtonGhost: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151'
  },
  footerButtonTextSecondary: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700'
  },
  footerButtonTextGhost: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700'
  }
});
