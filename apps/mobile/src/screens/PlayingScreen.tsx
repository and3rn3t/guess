import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
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
  {
    label: 'Uncertain',
    value: 'unknown',
    tone: 'maybe',
    accessibilityHint: 'Use when you do not know or are uncertain about this statement'
  }
];

function getAnswerToneStyle(tone: AnswerButtonConfig['tone']): object {
  switch (tone) {
    case 'yes':
      return styles.answerButtonYes;
    case 'no':
      return styles.answerButtonNo;
    case 'maybe':
      return styles.answerButtonMaybe;
    case 'secondary':
    default:
      return styles.answerButtonSecondary;
  }
}

function getAnswerTextToneStyle(tone: AnswerButtonConfig['tone']): object {
  switch (tone) {
    case 'yes':
      return styles.answerButtonTextYes;
    case 'no':
      return styles.answerButtonTextNo;
    case 'maybe':
      return styles.answerButtonTextMaybe;
    case 'secondary':
    default:
      return styles.answerButtonTextSecondary;
  }
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
  const confidenceLabel = formatConfidence(confidence);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const hasRenderedQuestionRef = useRef(false);
  const hasTrackedErrorRef = useRef(false);
  const swipeHandledRef = useRef(false);
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

  useEffect(() => {
    if (!hasRenderedQuestionRef.current) {
      hasRenderedQuestionRef.current = true;
      return;
    }

    triggerImpactHaptic('light');
  }, [questionText]);

  useEffect(() => {
    if (!hasTrackedErrorRef.current) {
      hasTrackedErrorRef.current = true;
      return;
    }

    if (errorMessage) {
      triggerNotificationHaptic('error');
    }
  }, [errorMessage]);

  const handleAnswer = (value: AnswerValue): void => {
    triggerImpactHaptic('light');
    onAnswer(value);
  };

  const handleSkip = (): void => {
    setIsActionsOpen(false);
    triggerImpactHaptic('medium');
    onSkip();
  };

  const handleEndGame = (): void => {
    setIsActionsOpen(false);
    triggerNotificationHaptic('warning');
    onEndGame();
  };

  const handleOpenActions = (): void => {
    if (isBusy) {
      return;
    }

    setIsActionsOpen(true);
    triggerImpactHaptic('light');
  };

  const handleCloseActions = (): void => {
    if (!isActionsOpen) {
      return;
    }

    setIsActionsOpen(false);
    triggerImpactHaptic('light');
  };

  const actionsSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isBusy || isActionsOpen) {
          return false;
        }

        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipeHandledRef.current || isBusy || isActionsOpen) {
          return;
        }

        const isSwipeUp = gestureState.dy < -28;
        const isMostlyVertical = Math.abs(gestureState.dx) < 44;

        if (isSwipeUp && isMostlyVertical) {
          swipeHandledRef.current = true;
          handleOpenActions();
        }
      },
      onPanResponderRelease: () => {
        swipeHandledRef.current = false;
      },
      onPanResponderTerminate: () => {
        swipeHandledRef.current = false;
      }
    })
  ).current;

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
          const toneStyle = getAnswerToneStyle(entry.tone);
          const toneTextStyle = getAnswerTextToneStyle(entry.tone);

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
                toneStyle,
                isBusy ? styles.answerButtonDisabled : null,
                pressed && !isBusy ? styles.answerButtonPressed : null
              ]}
            >
              <Text
                style={[
                  styles.answerButtonText,
                  toneTextStyle
                ]}
              >
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerActions}>
        <View {...actionsSwipeResponder.panHandlers} style={styles.moreActionsGestureArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open more actions"
            accessibilityHint="Opens menu with skip and end game actions. You can also swipe up here."
            disabled={isBusy}
            onPress={handleOpenActions}
            style={({ pressed }) => [
              styles.moreActionsButton,
              isBusy ? styles.answerButtonDisabled : null,
              pressed && !isBusy ? styles.answerButtonPressed : null
            ]}
          >
            <Text style={styles.moreActionsButtonText}>More Actions</Text>
          </Pressable>
          <Text style={styles.moreActionsHint}>Swipe up for quick actions</Text>
        </View>
      </View>

      <Modal
        animationType={prefersReducedMotion ? 'none' : 'slide'}
        transparent
        visible={isActionsOpen}
        onRequestClose={handleCloseActions}
      >
        <Pressable style={styles.sheetBackdrop} onPress={handleCloseActions}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Secondary Actions</Text>
            <Text style={styles.sheetSubtitle}>Keep the main flow focused and use these only when needed.</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip current question"
              accessibilityHint="Moves to the next best question without recording an answer"
              disabled={isBusy}
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.sheetActionButton,
                styles.sheetActionButtonSecondary,
                isBusy ? styles.answerButtonDisabled : null,
                pressed && !isBusy ? styles.answerButtonPressed : null
              ]}
            >
              <Text style={styles.sheetActionButtonSecondaryText}>Skip Question</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End game"
              accessibilityHint="Ends the current round and moves to game over"
              disabled={isBusy}
              onPress={handleEndGame}
              style={({ pressed }) => [
                styles.sheetActionButton,
                styles.sheetActionButtonGhost,
                isBusy ? styles.answerButtonDisabled : null,
                pressed && !isBusy ? styles.answerButtonPressed : null
              ]}
            >
              <Text style={styles.sheetActionButtonGhostText}>End Game</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close action menu"
              onPress={handleCloseActions}
              style={({ pressed }) => [styles.sheetCancelButton, pressed ? styles.answerButtonPressed : null]}
            >
              <Text style={styles.sheetCancelButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    gap: 20
  },
  headerBlock: {
    gap: 10
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
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800'
  },
  subtitle: {
    color: '#dbeafe',
    fontSize: 16,
    lineHeight: 24
  },
  questionCard: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#0b1f52'
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
    color: '#bfdbfe',
    fontSize: 14,
    lineHeight: 20
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
    fontSize: 13,
    fontWeight: '700'
  },
  questionText: {
    color: '#eff6ff',
    fontSize: 21,
    lineHeight: 30,
    fontWeight: '700'
  },
  reasoningText: {
    color: '#dbeafe',
    fontSize: 14,
    lineHeight: 20
  },
  metaText: {
    color: '#93c5fd',
    fontSize: 13,
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
    gap: 12
  },
  answerButton: {
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: 'center'
  },
  answerButtonYes: {
    backgroundColor: '#22c55e'
  },
  answerButtonNo: {
    backgroundColor: '#ef4444'
  },
  answerButtonMaybe: {
    backgroundColor: '#8b5cf6'
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
    fontSize: 17,
    fontWeight: '700'
  },
  answerButtonTextYes: {
    color: '#052e16'
  },
  answerButtonTextNo: {
    color: '#fff1f2'
  },
  answerButtonTextMaybe: {
    color: '#f3e8ff'
  },
  answerButtonTextSecondary: {
    color: '#e2e8f0'
  },
  answerButtonPressed: {
    transform: [{ scale: 0.98 }]
  },
  footerActions: {
    alignItems: 'center',
    marginTop: 6
  },
  moreActionsGestureArea: {
    alignItems: 'center',
    gap: 6
  },
  moreActionsButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  moreActionsButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  moreActionsHint: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'flex-end'
  },
  sheetContainer: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 10
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#334155',
    marginBottom: 4
  },
  sheetTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700'
  },
  sheetSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19
  },
  sheetActionButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  sheetActionButtonSecondary: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155'
  },
  sheetActionButtonGhost: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151'
  },
  sheetActionButtonSecondaryText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  sheetActionButtonGhostText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  },
  sheetCancelButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1e293b'
  },
  sheetCancelButtonText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700'
  }
});
