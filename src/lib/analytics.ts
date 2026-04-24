import { KV_ANALYTICS, MAX_ANALYTICS_EVENTS } from '@/lib/constants'
import { runWhenIdle } from '@/lib/idle'
import type { Difficulty } from '@/lib/types'

interface AnalyticsEvent {
  event: string
  timestamp: number
  data?: Record<string, string | number | boolean>
}

function loadEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(KV_ANALYTICS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEvents(events: AnalyticsEvent[]) {
  // Keep only the most recent events to avoid unbounded growth
  const trimmed = events.slice(-MAX_ANALYTICS_EVENTS)
  // Defer the localStorage write to idle time so it doesn't compete with
  // user interactions on the main thread (analytics is non-critical).
  runWhenIdle(() => {
    try {
      localStorage.setItem(KV_ANALYTICS, JSON.stringify(trimmed))
    } catch {
      // Storage full or unavailable — silently drop
    }
  })
}

export function trackEvent(event: string, data?: Record<string, string | number | boolean>) {
  const events = loadEvents()
  events.push({ event, timestamp: Date.now(), data })
  saveEvents(events)
}

// ========== CONVENIENCE TRACKERS ==========

export function trackGameStart(difficulty: Difficulty, characterCount: number) {
  trackEvent('game_start', { difficulty, characterCount })
}

export function trackGameEnd(won: boolean, difficulty: Difficulty, questionsAsked: number, guessCount?: number, exhausted?: boolean) {
  const data: Record<string, string | number | boolean> = { won, difficulty, questionsAsked }
  if (guessCount != null) data.guessCount = guessCount
  if (exhausted != null) data.exhausted = exhausted
  trackEvent('game_end', data)
}

export function trackShare(method: 'native' | 'clipboard' | 'link') {
  trackEvent('share', { method })
}

export function trackFeatureUse(feature: string) {
  trackEvent('feature_use', { feature })
}
