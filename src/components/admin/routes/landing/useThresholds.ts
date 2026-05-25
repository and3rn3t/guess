import { useEffect, useState } from 'react'

import {
  DEFAULT_THRESHOLDS,
  parseThresholds,
  THRESHOLDS_STORAGE_KEY,
  type AlertThresholds,
} from './landingHelpers'

export function useThresholds(): {
  thresholds: AlertThresholds
  setThreshold: (field: keyof AlertThresholds, value: string) => void
  resetThresholds: () => void
} {
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS)

  useEffect(() => {
    const stored = localStorage.getItem(THRESHOLDS_STORAGE_KEY)
    setThresholds(parseThresholds(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  const setThreshold = (field: keyof AlertThresholds, value: string): void => {
    const next = Number.parseInt(value, 10)
    setThresholds((prev) => ({
      ...prev,
      [field]: Number.isNaN(next) ? 0 : Math.max(0, next),
    }))
  }

  return { thresholds, setThreshold, resetThresholds: () => setThresholds(DEFAULT_THRESHOLDS) }
}
