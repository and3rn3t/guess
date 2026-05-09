import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileGameState } from '../state/mobileGameState';

interface PreferencesScreenProps {
  state: MobileGameState;
  onOpenTeaching: () => void;
  onBackToWelcome: () => void;
}

export function PreferencesScreen({
  state,
  onOpenTeaching,
  onBackToWelcome
}: Readonly<PreferencesScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>PREFERENCES</Text>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>Utility surface placeholder for local settings and accessibility controls.</Text>
      </View>

      <View style={styles.settingsBlock}>
        <Text style={styles.settingsLabel}>Current Session Preferences Snapshot</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingKey}>Saved Session</Text>
          <Text style={styles.settingValue}>{state.lastSessionId ?? 'none'}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingKey}>Busy State</Text>
          <Text style={styles.settingValue}>{state.isBusy ? 'Enabled' : 'Idle'}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingKey}>Error Banner</Text>
          <Text style={styles.settingValue}>{state.lastError ? 'Visible' : 'None'}</Text>
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable onPress={onOpenTeaching} style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Open Teaching</Text>
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
  settingsBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  settingsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  settingKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  settingValue: {
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
