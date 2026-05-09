import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileGameState } from '../state/mobileGameState';

interface TeachingScreenProps {
  state: MobileGameState;
  onOpenFeedback: () => void;
  onBackToWelcome: () => void;
}

export function TeachingScreen({
  state,
  onOpenFeedback,
  onBackToWelcome
}: Readonly<TeachingScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>TEACHING</Text>
        <Text style={styles.title}>Teaching</Text>
        <Text style={styles.subtitle}>Utility surface placeholder for guided strategy lessons.</Text>
      </View>

      <View style={styles.lessonsBlock}>
        <Text style={styles.lessonsLabel}>Lesson Progress (Placeholder)</Text>
        <View style={styles.lessonItem}>
          <Text style={styles.lessonKey}>Question Strategy</Text>
          <Text style={styles.lessonValue}>Pending</Text>
        </View>
        <View style={styles.lessonItem}>
          <Text style={styles.lessonKey}>Contradiction Recovery</Text>
          <Text style={styles.lessonValue}>Pending</Text>
        </View>
        <View style={styles.lessonItem}>
          <Text style={styles.lessonKey}>Guess Timing</Text>
          <Text style={styles.lessonValue}>Pending</Text>
        </View>
      </View>

      <View style={styles.metricsBlock}>
        <Text style={styles.metricsLabel}>Current Session Context</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Guesses</Text>
          <Text style={styles.metricValue}>{state.guessCount}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Confidence</Text>
          <Text style={styles.metricValue}>{state.guessConfidence ?? 'n/a'}</Text>
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable onPress={onOpenFeedback} style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Open Feedback</Text>
        </Pressable>
        <Pressable onPress={onBackToWelcome} style={[styles.actionButton, styles.actionSecondary]}>
          <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>Back To Welcome</Text>
        </Pressable>
      </View>

      {state.lastError ? <Text style={styles.errorText}>{state.lastError}</Text> : null}
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
  lessonsBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  lessonsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  lessonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  lessonKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  lessonValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  metricsBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  metricsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  metricKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  actionsBlock: {
    gap: 10
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionPrimary: {
    backgroundColor: '#7c3aed'
  },
  actionSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280'
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '700'
  },
  actionLabelPrimary: {
    color: '#ffffff'
  },
  actionLabelSecondary: {
    color: '#d1d5db'
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7f1d1d'
  }
});
