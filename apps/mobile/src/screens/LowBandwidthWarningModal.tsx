import { useEffect, useState, type ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMobileConnectionStatus } from '../network/useMobileConnectionStatus';

export function LowBandwidthWarningModal(): ReactElement | null {
  const status = useMobileConnectionStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status.tone !== 'limited') {
      setDismissed(false);
    }
  }, [status.tone]);

  if (status.tone !== 'limited' || dismissed) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Low bandwidth</Text>
          <Text style={styles.title}>You are on cellular data.</Text>
          <Text style={styles.body}>
            The game will stay playable, but images and network requests may take a little longer than normal.
          </Text>
          <View style={styles.actionsRow}>
            <Pressable accessibilityRole="button" onPress={() => setDismissed(true)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Keep Playing</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10
  },
  kicker: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800'
  },
  body: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800'
  }
});
