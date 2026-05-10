import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ResumeScreenProps {
  isBusy: boolean;
  isOffline: boolean;
  savedSessionId: string | null;
  errorMessage: string | null;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumeScreen({
  isBusy,
  isOffline,
  savedSessionId,
  errorMessage,
  onResume,
  onDiscard
}: Readonly<ResumeScreenProps>): ReactElement {
  const hasSession = Boolean(savedSessionId);

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>RESUME</Text>
        <Text style={styles.title}>Resume Previous Session</Text>
        <Text style={styles.subtitle}>Restore your last run or discard it and start fresh.</Text>
      </View>

      <View style={styles.sessionCard}>
        <Text style={styles.sessionLabel}>Saved Session</Text>
        <Text style={styles.sessionValue}>{savedSessionId ?? 'none'}</Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {isOffline && hasSession && !errorMessage ? (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineCardText}>You're offline — your session is preserved. Resume will work when you reconnect.</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || !hasSession || isOffline}
        onPress={onResume}
        style={[styles.actionButton, styles.actionPrimary, isBusy || !hasSession || isOffline ? styles.disabled : null]}
      >
        <Text style={styles.actionPrimaryText}>{hasSession ? 'Resume To Playing' : 'No Session To Resume'}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onDiscard}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Discard And Welcome</Text>
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
    backgroundColor: '#ddd6fe',
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
  sessionCard: {
    borderWidth: 1,
    borderColor: '#4c1d95',
    borderRadius: 14,
    backgroundColor: '#2e1065',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  sessionLabel: {
    color: '#ddd6fe',
    fontSize: 13,
    fontWeight: '700'
  },
  sessionValue: {
    color: '#ede9fe',
    fontSize: 14,
    fontWeight: '600'
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  offlineCard: {
    borderWidth: 1,
    borderColor: '#92400e',
    borderRadius: 12,
    backgroundColor: '#1c1007',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  offlineCardText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
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
  disabled: {
    opacity: 0.5
  }
});
