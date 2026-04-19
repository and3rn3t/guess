import { KV_ANALYTICS, MAX_ANALYTICS_EVENTS } from '@/lib/constants'
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
  try {
    localStorage.setItem(KV_ANALYTICS, JSON.stringify(trimmed))
  } catch {
    // Storage full or unavailable — silently drop
  }
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

export function trackGameEnd(won: boolean, difficulty: Difficulty, questionsAsked: number) {
  trackEvent('game_end', { won, difficulty, questionsAsked })
}

export function trackShare(method: 'native' | 'clipboard' | 'link') {
  trackEvent('share', { method })
}

export function trackFeatureUse(feature: string) {
  trackEvent('feature_use', { feature })
}
