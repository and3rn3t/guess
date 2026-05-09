import { useCallback } from 'react'
import { NativeHaptics } from '../native/NativeServices'
import type { HapticStyle } from '../native/NativeServices'

/**
 * Safe wrapper around the native haptics module.
 *
 * Returns a stable callback that no-ops gracefully when the native
 * module is unavailable (simulators, non-registered environments).
 */
export function useHaptics() {
  const trigger = useCallback(
    (style: HapticStyle = 'light') => {
      if (!NativeHaptics || typeof NativeHaptics.trigger !== 'function') return
      void NativeHaptics.trigger(style)
    },
    [],
  )

  const success = useCallback(() => {
    if (!NativeHaptics || typeof NativeHaptics.success !== 'function') return
    void NativeHaptics.success()
  }, [])

  const warning = useCallback(() => {
    if (!NativeHaptics || typeof NativeHaptics.warning !== 'function') return
    void NativeHaptics.warning()
  }, [])

  return { trigger, success, warning }
}
