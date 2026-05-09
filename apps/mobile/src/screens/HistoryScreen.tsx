import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileGameState } from '../state/mobileGameState';

interface HistoryScreenProps {
  state: MobileGameState;
  onOpenStats: () => void;
  onBackToWelcome: () => void;
}

export function HistoryScreen({ state, onOpenStats, onBackToWelcome }: Readonly<HistoryScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>HISTORY</Text>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Utility surface placeholder for previous-session browsing.</Text>
      </View>

      <View style={styles.sessionBlock}>
        <Text style={styles.sessionLabel}>Session History</Text>
        {state.lastSessionId ? (
          <View style={styles.sessionItem}>
            <Text style={styles.sessionKey}>Last Saved Session</Text>
            <Text style={styles.sessionValue}>{state.lastSessionId}</Text>
          </View>
        ) : (
          <Text style={styles.noDataText}>No saved sessions yet</Text>
        )}
        {state.sessionId && state.sessionId !== state.lastSessionId ? (
          <View style={styles.sessionItem}>
            <Text style={styles.sessionKey}>Current Session</Text>
            <Text style={styles.sessionValue}>{state.sessionId}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsBlock}>
        <Text style={styles.statsLabel}>Session Statistics</Text>
        <View style={styles.statItem}>
          <Text style={styles.statKey}>Total Guesses</Text>
          <Text style={styles.statValue}>{state.guessCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statKey}>Status</Text>
          <Text style={styles.statValue}>
            {state.exhausted ? 'Exhausted' : state.surrendered ? 'Surrendered' : 'Active'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable onPress={onOpenStats} style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Open Stats</Text>
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
  sessionBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  sessionLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  sessionKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  sessionValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Menlo'
  },
  noDataText: {
    color: '#94a3b8',
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  statsBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  statsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  statKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  statValue: {
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
