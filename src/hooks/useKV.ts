import { useState, useEffect, useCallback } from 'react'

/**
 * Drop-in replacement for @github/spark's useKV hook.
 * Persists state to localStorage with JSON serialization.
 * Falls back to defaultValue when storage is unavailable or empty.
 */
export function useKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`kv:${key}`)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    } catch {
      // Storage unavailable or corrupt — use default
    }
    return defaultValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(`kv:${key}`, JSON.stringify(value))
    } catch {
      // Storage full or unavailable — silently fail
    }
  }, [key, value])

  const setter = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prev)
        : newValue
      return resolved
    })
  }, [])

  return [value, setter]
}
