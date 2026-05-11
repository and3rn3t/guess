import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMobileSyncStatus } from '../network/useMobileSyncStatus';
import { useMobileOfflineQueue } from '../network/useMobileOfflineQueue';

const STATUS_COPY: Record<ReturnType<typeof useMobileSyncStatus>, { label: string; detail: string }> = {
  synced: {
    label: 'Synced',
    detail: 'Latest action is up to date.'
  },
  pending: {
    label: 'Syncing',
    detail: 'Submitting your latest action now.'
  },
  offline: {
    label: 'Queued offline',
    detail: 'Requests will retry when the device reconnects.'
  },
  error: {
    label: 'Sync error',
    detail: 'The last request needs another try.'
  }
};

export function SyncStatusBadge(): ReactElement {
  const status = useMobileSyncStatus();
  const queuedActionCount = useMobileOfflineQueue();
  const isHealthy = status === 'synced' && queuedActionCount === 0;
  const copy = queuedActionCount > 0 ? STATUS_COPY.offline : STATUS_COPY[status];
  const queuedCopy =
    queuedActionCount > 0
      ? getQueuedActionCopy(queuedActionCount)
      : copy.detail;

  return (
    <View
      accessible
      accessibilityLabel={isHealthy ? 'Synced.' : `${copy.label}. ${queuedCopy}`}
      style={[styles.root, styles[status], isHealthy ? styles.rootHealthy : null]}
    >
      <Text style={styles.label}>{copy.label}</Text>
      {isHealthy ? null : <Text style={styles.detail}>{queuedCopy}</Text>}
    </View>
  );
}

function getQueuedActionCopy(queuedActionCount: number): string {
  if (queuedActionCount === 1) {
    return '1 queued action waiting to sync.';
  }

  return `${queuedActionCount} queued actions waiting to sync.`;
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  rootHealthy: {
    paddingVertical: 8
  },
  synced: {
    backgroundColor: '#06281f',
    borderColor: '#10b981'
  },
  pending: {
    backgroundColor: '#2f1f08',
    borderColor: '#f59e0b'
  },
  offline: {
    backgroundColor: '#2a0f14',
    borderColor: '#f87171'
  },
  error: {
    backgroundColor: '#3f1d1d',
    borderColor: '#fb7185'
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
