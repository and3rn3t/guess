import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import type { AnswerValue } from '../network/mobileGameApi';
import { triggerImpactHaptic, triggerNotificationHaptic } from '../lib/mobileHaptics';
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

interface AnswerButtonConfig {
  readonly label: string;
  readonly value: AnswerValue;
  readonly tone: 'yes' | 'no' | 'maybe' | 'secondary';
  readonly accessibilityHint: string;
}

const ANSWER_BUTTONS: readonly AnswerButtonConfig[] = [
  { label: 'Yes', value: 'yes', tone: 'yes', accessibilityHint: 'Confirms this statement is true for your character' },
  { label: 'No', value: 'no', tone: 'no', accessibilityHint: 'Rejects this statement for your character' },
  { label: 'Maybe', value: 'maybe', tone: 'maybe', accessibilityHint: 'Marks this statement as uncertain' },
  {
    label: 'Unknown',
    value: 'unknown',
    tone: 'secondary',
    accessibilityHint: 'Use when you do not know the answer to this statement'
  }
];

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
  const confidenceLabel = formatConfidence(confidence);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentShiftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        setPrefersReducedMotion(enabled);
      })
      .catch(() => {
        setPrefersReducedMotion(false);
      });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      contentOpacity.setValue(1);
      contentShiftY.setValue(0);
      return;
    }

    contentOpacity.setValue(0.8);
    contentShiftY.setValue(6);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(contentShiftY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [contentOpacity, contentShiftY, prefersReducedMotion, questionText]);

  const handleAnswer = (value: AnswerValue): void => {
    triggerImpactHaptic('light');
    onAnswer(value);
  };

  const handleSkip = (): void => {
    triggerImpactHaptic('medium');
    onSkip();
  };

  const handleEndGame = (): void => {
    triggerNotificationHaptic('warning');
    onEndGame();
  };

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: contentOpacity,
          transform: [{ translateY: contentShiftY }]
        }
      ]}
    >
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
        <Text style={styles.metaText}>Confidence: {confidenceLabel}</Text>
        {rejectCooldownRemaining !== null && rejectCooldownRemaining > 0 ? (
          <View style={styles.cooldownCard}>
            <Text style={styles.cooldownText}>
              Next guess available in {rejectCooldownRemaining} more {rejectCooldownRemaining === 1 ? 'question' : 'questions'}
            </Text>
          </View>
        ) : null}
      </View>

      {isBusy ? (
        <View style={styles.busyCard}>
          <ActivityIndicator color="#93c5fd" size="small" />
          <Text style={styles.busyText}>Submitting your answer...</Text>
        </View>
      ) : (
        <Text style={styles.helperText}>Choose the answer that best fits your character to keep the model calibrated.</Text>
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <SyncStatusBadge />

      <View style={styles.answerGrid}>
        {ANSWER_BUTTONS.map((entry) => {
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Answer ${entry.label}`}
              accessibilityHint={entry.accessibilityHint}
              key={entry.value}
              disabled={isBusy}
                onPress={() => handleAnswer(entry.value)}
              style={({ pressed }) => [
                styles.answerButton,
                entry.tone === 'yes'
                  ? styles.answerButtonYes
                  : entry.tone === 'no'
                    ? styles.answerButtonNo
                    : entry.tone === 'maybe'
                      ? styles.answerButtonMaybe
                      : styles.answerButtonSecondary,
                isBusy ? styles.answerButtonDisabled : null,
                pressed && !isBusy ? styles.answerButtonPressed : null
              ]}
            >
              <Text
                style={[
                  styles.answerButtonText,
                  entry.tone === 'yes'
                    ? styles.answerButtonTextYes
                    : entry.tone === 'no'
                      ? styles.answerButtonTextNo
                      : entry.tone === 'maybe'
                        ? styles.answerButtonTextMaybe
                        : styles.answerButtonTextSecondary
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
          accessibilityLabel="Skip current question"
          accessibilityHint="Moves to the next best question without recording an answer"
          disabled={isBusy}
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.footerButton,
            styles.footerButtonSecondary,
            isBusy ? styles.answerButtonDisabled : null,
            pressed && !isBusy ? styles.answerButtonPressed : null
          ]}
        >
          <Text style={styles.footerButtonTextSecondary}>Skip Question</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End game"
          accessibilityHint="Ends the current round and moves to game over"
          disabled={isBusy}
          onPress={handleEndGame}
          style={({ pressed }) => [
            styles.footerButton,
            styles.footerButtonGhost,
            isBusy ? styles.answerButtonDisabled : null,
            pressed && !isBusy ? styles.answerButtonPressed : null
          ]}
        >
          <Text style={styles.footerButtonTextGhost}>End Game</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function formatConfidence(confidence: number | null): string {
  if (confidence === null || Number.isNaN(confidence)) {
    return 'n/a';
  }

  if (confidence >= 0 && confidence <= 1) {
    return `${Math.round(confidence * 100)}%`;
  }

  return `${Math.round(confidence)}%`;
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
  busyCard: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  busyText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  helperText: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 19
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
  answerButtonYes: {
    backgroundColor: '#22c55e'
  },
  answerButtonNo: {
    backgroundColor: '#ef4444'
  },
  answerButtonMaybe: {
    backgroundColor: '#f59e0b'
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
  answerButtonTextYes: {
    color: '#052e16'
  },
  answerButtonTextNo: {
    color: '#fff1f2'
  },
  answerButtonTextMaybe: {
    color: '#451a03'
  },
  answerButtonTextSecondary: {
    color: '#e2e8f0'
  },
  answerButtonPressed: {
    transform: [{ scale: 0.98 }]
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
