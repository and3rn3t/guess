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

// ── Flush buffered events to the server ──────────────────────

/**
 * POST all buffered localStorage events to /api/v2/events, then clear the buffer.
 * Called at game end (non-blocking — errors are silently swallowed).
 * Only fires when the browser is online.
 */
export function flushEvents(): void {
  if (!navigator.onLine) return
  const events = loadEvents()
  if (events.length === 0) return

  const batch = events.slice(0, 50).map((e) => ({
    id: crypto.randomUUID(),
    eventType: e.event,
    data: e.data,
    clientTs: e.timestamp,
  }))

  // Fire-and-forget — analytics loss is acceptable
  fetch('/api/v2/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
    // keepalive ensures the request outlives the page if the user navigates away
    keepalive: true,
  })
    .then((res) => {
      if (res.ok) {
        // Clear only the events we successfully flushed
        const remaining = loadEvents().slice(batch.length)
        saveEvents(remaining)
      }
    })
    .catch(() => { /* silently drop — client will retry on next game end */ })
}

// ── Convenience trackers ──────────────────────────────────────

export function trackGameStart(difficulty: Difficulty, characterCount: number) {
  trackEvent('game_start', { difficulty, characterCount })
}

export function trackGameEnd(won: boolean, difficulty: Difficulty, questionsAsked: number, guessCount?: number, exhausted?: boolean) {
  const data: Record<string, string | number | boolean> = { won, difficulty, questionsAsked }
  if (guessCount != null) data.guessCount = guessCount
  if (exhausted != null) data.exhausted = exhausted
  trackEvent('game_end', data)
  // Flush on every game end — this is a natural network idle point
  flushEvents()
}

export function trackShare(method: 'native' | 'clipboard' | 'link') {
  trackEvent('share', { method })
}

export function trackFeatureUse(feature: string) {
  trackEvent('feature_use', { feature })
}
