/**
 * Native iOS Services Bridge Contract
 * 
 * TypeScript type definitions for native Swift modules exposed via React Native bridge.
 * 
 * Import and use these types in mobile app code to interact with native capabilities.
 * All methods return Promises and will gracefully handle unavailability.
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

// MARK: - Native Haptics

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

interface NativeHapticsModule {
  /**
   * Trigger an impact haptic with the specified style.
   * Resolves immediately on simulator or if haptics are unavailable.
   */
  trigger(style: HapticStyle): Promise<void>;
  
  /**
   * Trigger a success notification haptic.
   */
  success(): Promise<void>;
  
  /**
   * Trigger a warning notification haptic.
   */
  warning(): Promise<void>;
  
  /**
   * Trigger an error notification haptic.
   */
  error(): Promise<void>;
  
  /**
   * Trigger a selection change haptic (subtle).
   */
  selection(): Promise<void>;
}

// MARK: - Native VoiceOver

export type VoiceOverPriority = 'low' | 'default' | 'high';

interface NativeVoiceOverModule {
  /**
   * Announce a message to VoiceOver users.
   * No-op if VoiceOver is not running.
   */
  announce(message: string, priority?: VoiceOverPriority): Promise<void>;
  
  /**
   * Check if VoiceOver is currently running.
   */
  isVoiceOverRunning(): Promise<boolean>;
  
  /**
   * Announce a screen change (for navigation).
   */
  announceScreenChange(message?: string): Promise<void>;
  
  /**
   * Announce a layout change (for content updates).
   */
  announceLayoutChange(message?: string): Promise<void>;
}

// MARK: - Native Reduce Motion

export interface MotionSettings {
  reduceMotion: boolean;
  differentiateWithoutColor?: boolean;
  onOffSwitchLabels?: boolean;
  reduceTransparency?: boolean;
}

export interface ReduceMotionChangedEvent {
  isEnabled: boolean;
}

interface NativeReduceMotionModule {
  /**
   * Get the current reduce motion setting.
   */
  isEnabled(): Promise<boolean>;
  
  /**
   * Get all motion-related accessibility settings.
   */
  getMotionSettings(): Promise<MotionSettings>;
  
  /**
   * Add listener for reduce motion changes.
   * Event emitter will be available through new NativeEventEmitter(NativeReduceMotion)
   */
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

// MARK: - Native Lifecycle

export type LifecycleState = 'active' | 'inactive' | 'background';

export interface LifecycleChangedEvent {
  state: LifecycleState;
}

interface NativeLifecycleModule {
  /**
   * Get the current app lifecycle state.
   */
  getCurrentState(): Promise<LifecycleState>;
  
  /**
   * Add listener for lifecycle changes.
   * Event emitter will be available through new NativeEventEmitter(NativeLifecycle)
   */
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

// MARK: - Module Exports

export const NativeHaptics: NativeHapticsModule = NativeModules.NativeHaptics;
export const NativeVoiceOver: NativeVoiceOverModule = NativeModules.NativeVoiceOver;
export const NativeReduceMotion: NativeReduceMotionModule = NativeModules.NativeReduceMotion;
export const NativeLifecycle: NativeLifecycleModule = NativeModules.NativeLifecycle;

// Event emitters for subscription-based modules
export const ReduceMotionEmitter = new NativeEventEmitter(NativeReduceMotion);
export const LifecycleEmitter = new NativeEventEmitter(NativeLifecycle);

// MARK: - Helper Hooks (optional - for use in React components)

/**
 * Example usage in React components:
 * 
 * import { useReduceMotion, useLifecycle, NativeHaptics } from './NativeServices';
 * 
 * function GameScreen() {
 *   const reduceMotion = useReduceMotion();
 *   const lifecycleState = useLifecycle();
 *   
 *   const handleButtonPress = async () => {
 *     await NativeHaptics.trigger('medium');
 *     // ... handle action
 *   };
 *   
 *   return reduceMotion ? <SimplifiedAnimation /> : <RichAnimation />;
 * }
 */
