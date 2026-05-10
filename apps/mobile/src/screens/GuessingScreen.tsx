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
import { triggerImpactHaptic, triggerNotificationHaptic } from '../lib/mobileHaptics';

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
  const confidenceLabel = formatGuessConfidence(confidence);
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

    contentOpacity.setValue(0.82);
    contentShiftY.setValue(8);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(contentShiftY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [characterName, contentOpacity, contentShiftY, prefersReducedMotion]);

  const handleConfirm = (): void => {
    triggerNotificationHaptic('success');
    onConfirm();
  };

  const handleReject = (): void => {
    triggerImpactHaptic('medium');
    onReject();
  };

  const handleSurrender = (): void => {
    triggerNotificationHaptic('warning');
    onSurrender();
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
        <Text style={styles.guessMeta}>Confidence: {confidenceLabel}</Text>
      </View>

      {isBusy ? (
        <View style={styles.busyCard}>
          <ActivityIndicator color="#86efac" size="small" />
          <Text style={styles.busyText}>Submitting your decision...</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Confirm guess"
        accessibilityHint="Confirms this character as correct"
        disabled={isBusy}
        onPress={handleConfirm}
        style={({ pressed }) => [
          styles.actionButton,
          styles.actionPrimary,
          isBusy ? styles.disabled : null,
          pressed && !isBusy ? styles.pressed : null
        ]}
      >
        <Text style={styles.actionPrimaryText}>Yes, Correct Guess</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reject guess"
        accessibilityHint="Rejects this candidate and continues asking questions"
        disabled={isBusy}
        onPress={handleReject}
        style={({ pressed }) => [
          styles.actionButton,
          styles.actionSecondary,
          isBusy ? styles.disabled : null,
          pressed && !isBusy ? styles.pressed : null
        ]}
      >
        <Text style={styles.actionSecondaryText}>No, Keep Going</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Surrender game"
        accessibilityHint="Ends this round as a loss"
        disabled={isBusy}
        onPress={handleSurrender}
        style={({ pressed }) => [
          styles.actionButton,
          styles.actionDanger,
          isBusy ? styles.disabled : null,
          pressed && !isBusy ? styles.pressed : null
        ]}
      >
        <Text style={styles.actionDangerText}>Surrender</Text>
      </Pressable>
    </Animated.View>
  );
}

function formatGuessConfidence(confidence: number | null): string {
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
  busyCard: {
    borderWidth: 1,
    borderColor: '#14532d',
    borderRadius: 10,
    backgroundColor: '#052e16',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  busyText: {
    color: '#dcfce7',
    fontSize: 13,
    fontWeight: '600'
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
  actionDanger: {
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#b91c1c'
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
  actionDangerText: {
    color: '#fee2e2',
    fontSize: 15,
    fontWeight: '700'
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.5
  }
});
