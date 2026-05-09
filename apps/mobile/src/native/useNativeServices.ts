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

const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> =>
  typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'

export function useHaptics() {
  const trigger = useCallback(async (style: HapticStyle) => {
    if (Platform.OS !== 'ios' || !NativeHaptics || typeof NativeHaptics.trigger !== 'function') return
    await NativeHaptics.trigger(style)
  }, [])

  const success = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics || typeof NativeHaptics.success !== 'function') return
    await NativeHaptics.success()
  }, [])

  const warning = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics || typeof NativeHaptics.warning !== 'function') return
    await NativeHaptics.warning()
  }, [])

  const error = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics || typeof NativeHaptics.error !== 'function') return
    await NativeHaptics.error()
  }, [])

  const selection = useCallback(async () => {
    if (Platform.OS !== 'ios' || !NativeHaptics || typeof NativeHaptics.selection !== 'function') return
    await NativeHaptics.selection()
  }, [])

  return { trigger, success, warning, error, selection }
}

export function useVoiceOver() {
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (
      Platform.OS !== 'ios' ||
      !NativeVoiceOver ||
      typeof NativeVoiceOver.isVoiceOverRunning !== 'function'
    ) {
      return
    }

    const result = NativeVoiceOver.isVoiceOverRunning()
    if (isPromiseLike<boolean>(result)) {
      result.then(setIsRunning).catch(() => setIsRunning(false))
      return
    }

    setIsRunning(Boolean(result))
  }, [])

  const announce = useCallback(async (message: string, priority: VoiceOverPriority = 'default') => {
    if (Platform.OS !== 'ios' || !NativeVoiceOver || typeof NativeVoiceOver.announce !== 'function') return
    await NativeVoiceOver.announce(message, priority)
  }, [])

  const announceScreenChange = useCallback(async (message?: string) => {
    if (
      Platform.OS !== 'ios' ||
      !NativeVoiceOver ||
      typeof NativeVoiceOver.announceScreenChange !== 'function'
    ) {
      return
    }
    await NativeVoiceOver.announceScreenChange(message)
  }, [])

  const announceLayoutChange = useCallback(async (message?: string) => {
    if (
      Platform.OS !== 'ios' ||
      !NativeVoiceOver ||
      typeof NativeVoiceOver.announceLayoutChange !== 'function'
    ) {
      return
    }
    await NativeVoiceOver.announceLayoutChange(message)
  }, [])

  return { isRunning, announce, announceScreenChange, announceLayoutChange }
}

export function useReduceMotion(): boolean {
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    if (
      Platform.OS !== 'ios' ||
      !NativeReduceMotion ||
      typeof NativeReduceMotion.isEnabled !== 'function'
    ) {
      return
    }

    const result = NativeReduceMotion.isEnabled()
    if (isPromiseLike<boolean>(result)) {
      result.then(setIsEnabled).catch(() => setIsEnabled(false))
    } else {
      setIsEnabled(Boolean(result))
    }

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
    if (
      Platform.OS !== 'ios' ||
      !NativeLifecycle ||
      typeof NativeLifecycle.getCurrentState !== 'function'
    ) {
      return
    }

    const result = NativeLifecycle.getCurrentState()
    if (isPromiseLike<LifecycleState>(result)) {
      result.then(setState).catch(() => setState('active'))
    } else if (
      result === 'active' ||
      result === 'inactive' ||
      result === 'background' ||
      result === 'unknown'
    ) {
      setState(result)
    } else {
      setState('active')
    }

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
