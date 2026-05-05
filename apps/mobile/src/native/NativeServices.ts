import { NativeEventEmitter, NativeModules } from 'react-native'

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
export type VoiceOverPriority = 'low' | 'default' | 'high'
export type LifecycleState = 'active' | 'inactive' | 'background'

export interface MotionSettings {
  reduceMotion: boolean
  differentiateWithoutColor?: boolean
  onOffSwitchLabels?: boolean
  reduceTransparency?: boolean
}

export interface ReduceMotionChangedEvent {
  isEnabled: boolean
}

export interface LifecycleChangedEvent {
  state: LifecycleState
}

interface NativeHapticsModule {
  trigger(style: HapticStyle): Promise<void>
  success(): Promise<void>
  warning(): Promise<void>
  error(): Promise<void>
  selection(): Promise<void>
}

interface NativeVoiceOverModule {
  announce(message: string, priority?: VoiceOverPriority): Promise<void>
  isVoiceOverRunning(): Promise<boolean>
  announceScreenChange(message?: string): Promise<void>
  announceLayoutChange(message?: string): Promise<void>
}

interface NativeReduceMotionModule {
  isEnabled(): Promise<boolean>
  getMotionSettings(): Promise<MotionSettings>
  addListener(eventType: string): void
  removeListeners(count: number): void
}

interface NativeLifecycleModule {
  getCurrentState(): Promise<LifecycleState>
  addListener(eventType: string): void
  removeListeners(count: number): void
}

export const NativeHaptics = NativeModules.NativeHaptics as NativeHapticsModule | undefined
export const NativeVoiceOver = NativeModules.NativeVoiceOver as NativeVoiceOverModule | undefined
export const NativeReduceMotion = NativeModules.NativeReduceMotion as NativeReduceMotionModule | undefined
export const NativeLifecycle = NativeModules.NativeLifecycle as NativeLifecycleModule | undefined

export const ReduceMotionEmitter = NativeReduceMotion
  ? new NativeEventEmitter(NativeReduceMotion)
  : null

export const LifecycleEmitter = NativeLifecycle
  ? new NativeEventEmitter(NativeLifecycle)
  : null
