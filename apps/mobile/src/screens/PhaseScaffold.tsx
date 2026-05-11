import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileGameAction, MobileGamePhase, MobileGameState } from '../state/mobileGameState';

interface ActionButton {
  label: string;
  action?: MobileGameAction;
  onPress?: () => void;
  tone?: 'primary' | 'secondary';
}

interface PhaseScaffoldProps {
  phase: MobileGamePhase;
  title: string;
  subtitle: string;
  state: MobileGameState;
  onDispatch: (action: MobileGameAction) => void;
  actions: readonly ActionButton[];
}

export function PhaseScaffold({
  phase,
  title,
  subtitle,
  state,
  onDispatch,
  actions
}: Readonly<PhaseScaffoldProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>{phase.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {__DEV__ && (
        <View style={styles.metricsRow}>
          <Text style={styles.metric}>Session: {state.sessionId ?? 'none'}</Text>
          <Text style={styles.metric}>Saved Session: {state.lastSessionId ?? 'none'}</Text>
          <Text style={styles.metric}>Guesses: {state.guessCount}</Text>
          <Text style={styles.metric}>Guess Confidence: {state.guessConfidence ?? 'n/a'}</Text>
          <Text style={styles.metric}>Reject Cooldown: {state.rejectCooldownRemaining ?? 'n/a'}</Text>
          <Text style={styles.metric}>Exhausted: {state.exhausted ? 'yes' : 'no'}</Text>
          <Text style={styles.metric}>Surrendered: {state.surrendered ? 'yes' : 'no'}</Text>
          <Text style={styles.metric}>Busy: {state.isBusy ? 'yes' : 'no'}</Text>
        </View>
      )}

      {state.currentQuestion ? (
        <View style={styles.questionBlock}>
          <Text style={styles.questionTitle}>Current Question</Text>
          <Text style={styles.questionText}>{state.currentQuestion.displayText ?? state.currentQuestion.text}</Text>
          {state.reasoning ? (
            <Text style={styles.reasoningText}>
              {state.reasoning.why} ({Math.round(state.reasoning.confidence)}% confidence)
            </Text>
          ) : null}
        </View>
      ) : null}

      {state.finalGuess ? (
        <View style={styles.guessBlock}>
          <Text style={styles.guessTitle}>Current Guess</Text>
          <Text style={styles.guessText}>{state.finalGuess.name}</Text>
        </View>
      ) : null}

      {state.lastError ? <Text style={styles.errorText}>{state.lastError}</Text> : null}

      <View style={styles.actionsBlock}>
        {actions.map((entry) => {
          const isPrimary = entry.tone !== 'secondary';
          const handlePress = (): void => {
            if (entry.onPress) {
              entry.onPress();
              return;
            }
            if (entry.action) {
              onDispatch(entry.action);
            }
          };

          return (
            <Pressable
              accessibilityRole="button"
              key={entry.label}
              onPress={handlePress}
              style={[styles.actionButton, isPrimary ? styles.actionPrimary : styles.actionSecondary]}
            >
              <Text style={[styles.actionLabel, isPrimary ? styles.actionLabelPrimary : styles.actionLabelSecondary]}>
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 22
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#101828',
    backgroundColor: '#d1fadf',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24
  },
  metricsRow: {
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  metric: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  questionBlock: {
    gap: 6,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0b1c44'
  },
  questionTitle: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '700'
  },
  questionText: {
    color: '#eff6ff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24
  },
  reasoningText: {
    color: '#dbeafe',
    fontSize: 13,
    lineHeight: 18
  },
  guessBlock: {
    gap: 4,
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#052e16'
  },
  guessTitle: {
    color: '#bbf7d0',
    fontSize: 13,
    fontWeight: '700'
  },
  guessText: {
    color: '#f0fdf4',
    fontSize: 16,
    fontWeight: '700'
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  actionsBlock: {
    gap: 12
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
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700'
  },
  actionLabelPrimary: {
    color: '#052e16'
  },
  actionLabelSecondary: {
    color: '#e2e8f0'
  }
});
