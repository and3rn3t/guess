import { useState, useEffect, useCallback, useRef } from 'react'

type OnErrorCallback = (error: unknown) => void

export function useKV<T>(
  key: string,
  defaultValue: T,
  options?: { onError?: OnErrorCallback }
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `kv:${key}`
  const onError = options?.onError

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    } catch (e) {
      onError?.(e)
    }
    return defaultValue
  })

  // Ref to avoid stale closure in storage event listener
  const valueRef = useRef(value)
  valueRef.current = value

  // Persist to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (e) {
      onError?.(e)
    }
  }, [storageKey, value, onError])

  // Cross-tab sync: listen for storage events from other tabs
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      if (event.newValue === null) {
        setValue(defaultValue)
        return
      }
      try {
        const parsed = JSON.parse(event.newValue) as T
        setValue(parsed)
      } catch (e) {
        onError?.(e)
      }
    }

    globalThis.addEventListener('storage', handler)
    return () => globalThis.removeEventListener('storage', handler)
  }, [storageKey, defaultValue, onError])

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
