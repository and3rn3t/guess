import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { triggerImpactHaptic } from '../lib/mobileHaptics';

export interface SecondaryActionItem {
  key: string;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

interface SecondaryActionsSheetProps {
  primaryLabel: string;
  primaryAccessibilityLabel: string;
  onPrimaryPress: () => void;
  isPrimaryDisabled?: boolean;
  secondaryActions: readonly SecondaryActionItem[];
  isSecondaryDisabled?: boolean;
}

export function SecondaryActionsSheet({
  primaryLabel,
  primaryAccessibilityLabel,
  onPrimaryPress,
  isPrimaryDisabled = false,
  secondaryActions,
  isSecondaryDisabled = false,
}: Readonly<SecondaryActionsSheetProps>): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasSecondaryActions = secondaryActions.length > 0;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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
      sheetTranslateY.setValue(isOpen ? 0 : 280);
      backdropOpacity.setValue(isOpen ? 1 : 0);
      return;
    }

    sheetTranslateY.setValue(isOpen ? 280 : 0);
    backdropOpacity.setValue(isOpen ? 0 : 1);
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: isOpen ? 0 : 280,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [isOpen, prefersReducedMotion, backdropOpacity, sheetTranslateY]);

  const handleClose = (): void => {
    setIsOpen(false);
    triggerImpactHaptic('light');
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryAccessibilityLabel}
        onPress={() => {
          onPrimaryPress();
        }}
        disabled={isPrimaryDisabled}
        style={[styles.primaryButton, isPrimaryDisabled ? styles.disabled : null]}
      >
        <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
      </Pressable>

      {hasSecondaryActions ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open more actions"
          accessibilityHint="Opens secondary actions for this screen"
          onPress={() => {
            triggerImpactHaptic('light');
            setIsOpen(true);
          }}
          disabled={isSecondaryDisabled}
          style={[styles.secondaryTriggerButton, isSecondaryDisabled ? styles.disabled : null]}
        >
          <Text style={styles.secondaryTriggerText}>More Actions</Text>
        </Pressable>
      ) : null}

      <Modal
        transparent
        animationType="none"
        visible={isOpen}
        onRequestClose={handleClose}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} onTouchEnd={handleClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Animated.View
              style={[
                styles.sheetContent,
                {
                  transform: [{ translateY: sheetTranslateY }]
                }
              ]}
            >
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Secondary Actions</Text>
              <View style={styles.actionsList}>
                {secondaryActions.map((action) => (
                  <Pressable
                    key={action.key}
                    accessibilityRole="button"
                    accessibilityLabel={action.accessibilityLabel}
                    onPress={() => {
                      handleClose();
                      action.onPress();
                    }}
                    style={styles.sheetActionButton}
                  >
                    <Text style={styles.sheetActionText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close action menu"
                onPress={handleClose}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryTriggerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6b7280',
    backgroundColor: 'transparent',
  },
  secondaryTriggerText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
  },
  sheetContent: {
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#334155',
    marginBottom: 4,
  },
  sheetTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  actionsList: {
    gap: 8,
  },
  sheetActionButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  sheetActionText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  cancelButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
});
