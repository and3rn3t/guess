import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import {
  LifecycleEmitter,
  NativeHaptics,
  NativeLifecycle,
  NativeReduceMotion,
  NativeVoiceOver,
  ReduceMotionEmitter,
  type HapticStyle,
  type LifecycleChangedEvent,
  type LifecycleState,
  type ReduceMotionChangedEvent,
  type VoiceOverPriority,
} from './NativeServices'

export function useHaptics() {
  const trigger = useCallback(async (style: HapticStyle) => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return
    await NativeHaptics.trigger(style)
  }, [])

  const success = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return
    await NativeHaptics.success()
  }, [])

  const warning = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return
    await NativeHaptics.warning()
  }, [])

  const error = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return
    await NativeHaptics.error()
  }, [])

  const selection = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics) return
    await NativeHaptics.selection()
  }, [])

  return { trigger, success, warning, error, selection }
}

export function useVoiceOver() {
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return

    NativeVoiceOver.isVoiceOverRunning()
      .then(setIsRunning)
      .catch(() => setIsRunning(false))
  }, [])

  const announce = useCallback(async (message: string, priority: VoiceOverPriority = 'default') => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return
    await NativeVoiceOver.announce(message, priority)
  }, [])

  const announceScreenChange = useCallback(async (message?: string) => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return
    await NativeVoiceOver.announceScreenChange(message)
  }, [])

  const announceLayoutChange = useCallback(async (message?: string) => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver) return
    await NativeVoiceOver.announceLayoutChange(message)
  }, [])

  return { isRunning, announce, announceScreenChange, announceLayoutChange }
}

export function useReduceMotion(): boolean {
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeReduceMotion) return

    NativeReduceMotion.isEnabled()
      .then(setIsEnabled)
      .catch(() => setIsEnabled(false))

    const subscription = ReduceMotionEmitter?.addListener(
      'reduceMotionChanged',
      (event: ReduceMotionChangedEvent) => {
        setIsEnabled(event.isEnabled)
      },
    )

    return () => {
      subscription?.remove()
    }
  }, [])

  return isEnabled
}

export function useLifecycle(): LifecycleState {
  const [state, setState] = useState<LifecycleState>('active')

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeLifecycle) return

    NativeLifecycle.getCurrentState()
      .then(setState)
      .catch(() => setState('active'))

    const subscription = LifecycleEmitter?.addListener(
      'lifecycleChanged',
      (event: LifecycleChangedEvent) => {
        setState(event.state)
      },
    )

    return () => {
      subscription?.remove()
    }
  }, [])

  return state
}

export function useOnAppActive(callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (Platform.OS !== 'ios' || !NativeLifecycle) return

    const subscription = LifecycleEmitter?.addListener(
      'lifecycleChanged',
      (event: LifecycleChangedEvent) => {
        if (event.state === 'active') {
          callbackRef.current()
        }
      },
    )

    return () => {
      subscription?.remove()
    }
  }, [])
}
