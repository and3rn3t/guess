import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileGameState } from '../state/mobileGameState';

interface CompareScreenProps {
  state: MobileGameState;
  onOpenPreferences: () => void;
  onBackToWelcome: () => void;
}

export function CompareScreen({ state, onOpenPreferences, onBackToWelcome }: Readonly<CompareScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>COMPARE</Text>
        <Text style={styles.title}>Compare</Text>
        <Text style={styles.subtitle}>Utility surface placeholder for category and difficulty comparisons.</Text>
      </View>

      <View style={styles.comparisonBlock}>
        <Text style={styles.comparisonLabel}>Performance Comparisons</Text>

        <View style={styles.comparisonGroup}>
          <Text style={styles.groupTitle}>By Difficulty</Text>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonKey}>Easy</Text>
            <Text style={styles.comparisonValue}>—</Text>
          </View>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonKey}>Normal</Text>
            <Text style={styles.comparisonValue}>—</Text>
          </View>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonKey}>Hard</Text>
            <Text style={styles.comparisonValue}>—</Text>
          </View>
        </View>

        <View style={styles.comparisonGroup}>
          <Text style={styles.groupTitle}>By Category</Text>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonKey}>Popular</Text>
            <Text style={styles.comparisonValue}>—</Text>
          </View>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonKey}>Niche</Text>
            <Text style={styles.comparisonValue}>—</Text>
          </View>
        </View>
      </View>

      <View style={styles.sessionMetrics}>
        <Text style={styles.metricsLabel}>Current Session</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Guesses</Text>
          <Text style={styles.metricValue}>{state.guessCount}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Status</Text>
          <Text style={styles.metricValue}>
            {state.exhausted ? 'Exhausted' : state.surrendered ? 'Surrendered' : 'Active'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable onPress={onOpenPreferences} style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Open Preferences</Text>
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
  comparisonBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  comparisonLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  comparisonGroup: {
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#7c3aed'
  },
  groupTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  comparisonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  comparisonKey: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500'
  },
  comparisonValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  sessionMetrics: {
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
