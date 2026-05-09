import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMobileConnectionStatus } from '../network/useMobileConnectionStatus';
import { useMobileOfflineQueue } from '../network/useMobileOfflineQueue';
import { useMobileSyncStatus } from '../network/useMobileSyncStatus';

export function ConnectionStatusBanner(): ReactElement {
  const status = useMobileConnectionStatus();
  const syncStatus = useMobileSyncStatus();
  const queuedActionCount = useMobileOfflineQueue();
  const queueDetail =
    queuedActionCount > 0
      ? `${queuedActionCount} queued action${queuedActionCount === 1 ? '' : 's'} waiting to sync.`
      : status.detail;

  return (
    <View
      accessibilityLabel={`${status.label}. ${queueDetail}. Sync state: ${syncStatus}.`}
      accessible
      style={[styles.root, styles[status.tone]]}
    >
      <View style={styles.row}>
        <Text style={styles.label}>{status.label}</Text>
        <View style={[styles.syncPill, styles[syncStatus]]}>
          <Text style={styles.syncPillText}>{syncStatus}</Text>
        </View>
      </View>
      <Text style={styles.detail}>{queueDetail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  online: {
    backgroundColor: '#06281f',
    borderColor: '#10b981'
  },
  limited: {
    backgroundColor: '#2a1a04',
    borderColor: '#f59e0b'
  },
  offline: {
    backgroundColor: '#2a0f14',
    borderColor: '#f87171'
  },
  pending: {
    backgroundColor: '#2f1f08',
    borderColor: '#f59e0b'
  },
  synced: {
    backgroundColor: '#06281f',
    borderColor: '#34d399'
  },
  error: {
    backgroundColor: '#3f1d1d',
    borderColor: '#fb7185'
  },
  syncPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  syncPillText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  label: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  detail: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18
  }
});
