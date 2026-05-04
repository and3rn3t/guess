/**
 * React Hooks for Native iOS Services
 * 
 * Convenient hooks for consuming native capabilities in React components.
 * All hooks gracefully handle module unavailability.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  NativeHaptics,
  NativeVoiceOver,
  NativeReduceMotion,
  NativeLifecycle,
  ReduceMotionEmitter,
  LifecycleEmitter,
  type HapticStyle,
  type ReduceMotionChangedEvent,
  type VoiceOverPriority,
  type LifecycleChangedEvent,
  type LifecycleState,
} from './mobile/NativeServices';

// MARK: - Haptics Hook

/**
 * Hook for triggering haptic feedback.
 * Returns functions that safely trigger haptics (no-op on Android/unavailable).
 */
export function useHaptics() {
  const trigger = useCallback(async (style: HapticStyle) => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return;
    try {
      await NativeHaptics.trigger(style);
    } catch (error) {
      console.warn('Haptics unavailable:', error);
    }
  }, []);

  const success = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return;
    try {
      await NativeHaptics.success();
    } catch (error) {
      console.warn('Haptics unavailable:', error);
    }
  }, []);

  const warning = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return;
    try {
      await NativeHaptics.warning();
    } catch (error) {
      console.warn('Haptics unavailable:', error);
    }
  }, []);

  const error = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return;
    try {
      await NativeHaptics.error();
    } catch (error) {
      console.warn('Haptics unavailable:', error);
    }
  }, []);

  const selection = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return;
    try {
      await NativeHaptics.selection();
    } catch (error) {
      console.warn('Haptics unavailable:', error);
    }
  }, []);

  return { trigger, success, warning, error, selection };
}

// MARK: - VoiceOver Hook

/**
 * Hook for VoiceOver announcements and status.
 */
export function useVoiceOver() {
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return;
    
    NativeVoiceOver.isVoiceOverRunning()
      .then(setIsRunning)
      .catch(() => setIsRunning(false));
  }, []);

  const announce = useCallback(async (message: string, priority?: VoiceOverPriority) => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return;
    try {
      await NativeVoiceOver.announce(message, priority);
    } catch (error) {
      console.warn('VoiceOver announcement failed:', error);
    }
  }, []);

  const announceScreenChange = useCallback(async (message?: string) => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return;
    try {
      await NativeVoiceOver.announceScreenChange(message);
    } catch (error) {
      console.warn('VoiceOver screen change announcement failed:', error);
    }
  }, []);

  const announceLayoutChange = useCallback(async (message?: string) => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return;
    try {
      await NativeVoiceOver.announceLayoutChange(message);
    } catch (error) {
      console.warn('VoiceOver layout change announcement failed:', error);
    }
  }, []);

  return { isRunning, announce, announceScreenChange, announceLayoutChange };
}

// MARK: - Reduce Motion Hook

/**
 * Hook that tracks the reduce motion setting.
 * Returns true if reduce motion is enabled, false otherwise.
 */
export function useReduceMotion(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeReduceMotion) return;

    // Get initial state
    NativeReduceMotion.isEnabled()
      .then(setIsEnabled)
      .catch(() => setIsEnabled(false));

    // Subscribe to changes
    const subscription = ReduceMotionEmitter?.addListener(
      'reduceMotionChanged',
      (event: ReduceMotionChangedEvent) => {
        setIsEnabled(event.isEnabled);
      }
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  return isEnabled;
}

// MARK: - Lifecycle Hook

/**
 * Hook that tracks app lifecycle state.
 * Returns current lifecycle state: 'active' | 'inactive' | 'background'
 */
export function useLifecycle(): LifecycleState {
  const [state, setState] = useState<LifecycleState>('active');

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeLifecycle) return;

    // Get initial state
    NativeLifecycle.getCurrentState()
      .then(setState)
      .catch(() => setState('active'));

    // Subscribe to changes
    const subscription = LifecycleEmitter?.addListener(
      'lifecycleChanged',
      (event: LifecycleChangedEvent) => {
        setState(event.state);
      }
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  return state;
}

// MARK: - Combined Accessibility Hook

/**
 * Hook that returns all accessibility-related states.
 * Useful for components that need to adapt to multiple accessibility settings.
 */
export function useAccessibility() {
  const reduceMotion = useReduceMotion();
  const { isRunning: isVoiceOverRunning } = useVoiceOver();

  return {
    reduceMotion,
    isVoiceOverRunning,
  };
}

// MARK: - Effect Hooks for Lifecycle Events

/**
 * Hook that triggers a callback when app becomes active.
 */
export function useOnAppActive(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeLifecycle) return;

    const subscription = LifecycleEmitter?.addListener(
      'lifecycleChanged',
      (event: LifecycleChangedEvent) => {
        if (event.state === 'active') {
          callbackRef.current();
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, []);
}

/**
 * Hook that triggers a callback when app enters background.
 */
export function useOnAppBackground(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeLifecycle) return;

    const subscription = LifecycleEmitter?.addListener(
      'lifecycleChanged',
      (event: LifecycleChangedEvent) => {
        if (event.state === 'background') {
          callbackRef.current();
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, []);
}

/**
 * Hook that triggers different callbacks based on lifecycle state changes.
 */
export function useLifecycleCallbacks(callbacks: {
  onActive?: () => void;
  onInactive?: () => void;
  onBackground?: () => void;
}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeLifecycle) return;

    const subscription = LifecycleEmitter?.addListener(
      'lifecycleChanged',
      (event: LifecycleChangedEvent) => {
        const { state } = event;
        const cbs = callbacksRef.current;
        
        if (state === 'active' && cbs.onActive) {
          cbs.onActive();
        } else if (state === 'inactive' && cbs.onInactive) {
          cbs.onInactive();
        } else if (state === 'background' && cbs.onBackground) {
          cbs.onBackground();
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, []);
}
