import type { Difficulty } from '@/lib/types'
import type { AnalyticsEvent } from '@/lib/db'

export type { AnalyticsEvent }

const STORAGE_KEY = 'kv:analytics'
const MAX_EVENTS = 500

function loadEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEvents(events: AnalyticsEvent[]) {
  // Keep only the most recent events to avoid unbounded growth
  const trimmed = events.slice(-MAX_EVENTS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
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

// ========== QUERY HELPERS ==========

export function getEvents(): AnalyticsEvent[] {
  return loadEvents()
}

export function getEventsSince(since: number): AnalyticsEvent[] {
  return loadEvents().filter((e) => e.timestamp >= since)
}

export function getEventCounts(): Record<string, number> {
  const events = loadEvents()
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.event] = (counts[e.event] || 0) + 1
  }
  return counts
}

export function clearAnalytics() {
  localStorage.removeItem(STORAGE_KEY)
}
