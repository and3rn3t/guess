/**
 * Native Services Debug Menu
 * 
 * Development-only UI for testing all native services interactively.
 * Add this to your app during development to manually test each native capability.
 * 
 * Usage:
 *   import { NativeServicesDebugMenu } from '@/native/NativeServicesDebugMenu';
 *   
 *   // In your app (dev only):
 *   {__DEV__ && <NativeServicesDebugMenu />}
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  useHaptics,
  useVoiceOver,
  useReduceMotion,
  useLifecycle,
} from './useNativeServices';
import type { HapticStyle, VoiceOverPriority } from './mobile/NativeServices';

export function NativeServicesDebugMenu() {
  const [isVisible, setIsVisible] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  if (!__DEV__) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <Pressable
        style={styles.floatingButton}
        onPress={() => setIsVisible(!isVisible)}
      >
        <Text style={styles.floatingButtonText}>🧪</Text>
      </Pressable>

      {/* Debug Menu */}
      {isVisible && (
        <View style={styles.overlay}>
          <View style={styles.menu}>
            <View style={styles.header}>
              <Text style={styles.title}>Native Services Debug</Text>
              <Pressable onPress={() => setIsVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.content}>
              <HapticsTestSection onResult={addTestResult} />
              <VoiceOverTestSection onResult={addTestResult} />
              <ReduceMotionTestSection onResult={addTestResult} />
              <LifecycleTestSection onResult={addTestResult} />

              {/* Test Results */}
              {testResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Test Results</Text>
                  {testResults.map((result, index) => (
                    <Text key={index} style={styles.resultText}>
                      {result}
                    </Text>
                  ))}
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => setTestResults([])}
                  >
                    <Text style={styles.clearButtonText}>Clear Results</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </>
  );

  function addTestResult(message: string) {
    setTestResults((prev) => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  }
}

// MARK: - Haptics Test Section

function HapticsTestSection({ onResult }: { onResult: (msg: string) => void }) {
  const haptics = useHaptics();

  const testHaptic = async (type: string, fn: () => Promise<void>) => {
    try {
      await fn();
      onResult(`✅ ${type} haptic triggered`);
    } catch (error) {
      onResult(`❌ ${type} failed: ${error}`);
    }
  };

  const hapticStyles: HapticStyle[] = ['light', 'medium', 'heavy', 'soft', 'rigid'];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎮 Haptics</Text>
      
      <Text style={styles.subsectionTitle}>Impact Styles:</Text>
      <View style={styles.buttonGrid}>
        {hapticStyles.map((style) => (
          <Pressable
            key={style}
            style={styles.smallButton}
            onPress={() => testHaptic(style, () => haptics.trigger(style))}
          >
            <Text style={styles.buttonText}>{style}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.subsectionTitle}>Notifications:</Text>
      <View style={styles.buttonGrid}>
        <Pressable
          style={[styles.smallButton, styles.successButton]}
          onPress={() => testHaptic('success', haptics.success)}
        >
          <Text style={styles.buttonText}>Success</Text>
        </Pressable>
        <Pressable
          style={[styles.smallButton, styles.warningButton]}
          onPress={() => testHaptic('warning', haptics.warning)}
        >
          <Text style={styles.buttonText}>Warning</Text>
        </Pressable>
        <Pressable
          style={[styles.smallButton, styles.errorButton]}
          onPress={() => testHaptic('error', haptics.error)}
        >
          <Text style={styles.buttonText}>Error</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => testHaptic('selection', haptics.selection)}
      >
        <Text style={styles.buttonText}>Selection Haptic</Text>
      </Pressable>
    </View>
  );
}

// MARK: - VoiceOver Test Section

function VoiceOverTestSection({ onResult }: { onResult: (msg: string) => void }) {
  const { announce, isRunning, announceScreenChange, announceLayoutChange } = useVoiceOver();
  const [testMessage] = useState('Test announcement');

  const testAnnouncement = async (priority: VoiceOverPriority) => {
    try {
      await announce(testMessage, priority);
      onResult(`✅ Announced with ${priority} priority`);
    } catch (error) {
      onResult(`❌ Announcement failed: ${error}`);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🗣️ VoiceOver</Text>
      
      <Text style={styles.infoText}>
        VoiceOver Status: {isRunning ? '✅ Running' : '❌ Not Running'}
      </Text>

      <Text style={styles.subsectionTitle}>Announcements:</Text>
      <View style={styles.buttonGrid}>
        <Pressable
          style={styles.smallButton}
          onPress={() => testAnnouncement('low')}
        >
          <Text style={styles.buttonText}>Low Priority</Text>
        </Pressable>
        <Pressable
          style={styles.smallButton}
          onPress={() => testAnnouncement('default')}
        >
          <Text style={styles.buttonText}>Default</Text>
        </Pressable>
        <Pressable
          style={styles.smallButton}
          onPress={() => testAnnouncement('high')}
        >
          <Text style={styles.buttonText}>High Priority</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.button}
        onPress={async () => {
          try {
            await announceScreenChange('Screen Changed');
            onResult('✅ Screen change announced');
          } catch (error) {
            onResult(`❌ Screen change failed: ${error}`);
          }
        }}
      >
        <Text style={styles.buttonText}>Announce Screen Change</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={async () => {
          try {
            await announceLayoutChange('Layout Updated');
            onResult('✅ Layout change announced');
          } catch (error) {
            onResult(`❌ Layout change failed: ${error}`);
          }
        }}
      >
        <Text style={styles.buttonText}>Announce Layout Change</Text>
      </Pressable>
    </View>
  );
}

// MARK: - Reduce Motion Test Section

function ReduceMotionTestSection({ onResult }: { onResult: (msg: string) => void }) {
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    onResult(`Reduce Motion: ${reduceMotion ? 'Enabled' : 'Disabled'}`);
  }, [reduceMotion]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎬 Reduce Motion</Text>
      
      <Text style={styles.infoText}>
        Current Status: {reduceMotion ? '✅ Enabled' : '❌ Disabled'}
      </Text>

      <Text style={styles.helpText}>
        To test: Settings → Accessibility → Motion → Reduce Motion
      </Text>

      {reduceMotion ? (
        <Text style={styles.infoText}>
          ✨ Animations should be simplified
        </Text>
      ) : (
        <Text style={styles.infoText}>
          🎭 Full animations enabled
        </Text>
      )}
    </View>
  );
}

// MARK: - Lifecycle Test Section

function LifecycleTestSection({ onResult }: { onResult: (msg: string) => void }) {
  const lifecycleState = useLifecycle();

  useEffect(() => {
    onResult(`Lifecycle State: ${lifecycleState}`);
  }, [lifecycleState]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📱 Lifecycle</Text>
      
      <Text style={styles.infoText}>
        Current State: {lifecycleState.toUpperCase()}
      </Text>

      <Text style={styles.helpText}>
        To test: Background the app and return
      </Text>

      <View style={styles.stateIndicator}>
        <View style={[
          styles.stateDot,
          lifecycleState === 'active' && styles.stateDotActive,
          lifecycleState === 'inactive' && styles.stateDotInactive,
          lifecycleState === 'background' && styles.stateDotBackground,
        ]} />
        <Text style={styles.stateText}>
          {lifecycleState === 'active' && '✅ App is Active'}
          {lifecycleState === 'inactive' && '⏸️ App is Inactive'}
          {lifecycleState === 'background' && '🌙 App is Backgrounded'}
        </Text>
      </View>
    </View>
  );
}

// MARK: - Styles

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  floatingButtonText: {
    fontSize: 30,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  menu: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#34C759',
  },
  warningButton: {
    backgroundColor: '#FF9500',
  },
  errorButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  stateDotActive: {
    backgroundColor: '#34C759',
  },
  stateDotInactive: {
    backgroundColor: '#FF9500',
  },
  stateDotBackground: {
    backgroundColor: '#8E8E93',
  },
  stateText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
