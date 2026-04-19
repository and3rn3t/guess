import { describe, it, expect, vi, beforeEach } from 'vitest'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
})

describe('trackEvent', () => {
  it('stores an event in localStorage', async () => {
    const { trackEvent, getEvents } = await import('./analytics')
    trackEvent('test_event')

    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('test_event')
    expect(events[0].timestamp).toBeGreaterThan(0)
  })

  it('stores event data', async () => {
    const { trackEvent, getEvents } = await import('./analytics')
    trackEvent('test_event', { key: 'value', num: 42 })

    const events = getEvents()
    expect(events[0].data).toEqual({ key: 'value', num: 42 })
  })

  it('appends to existing events', async () => {
    const { trackEvent, getEvents } = await import('./analytics')
    trackEvent('event_1')
    trackEvent('event_2')

    expect(getEvents()).toHaveLength(2)
  })

  it('caps at MAX_ANALYTICS_EVENTS', async () => {
    const { trackEvent, getEvents } = await import('./analytics')
    // Pre-fill with 500 events
    const existingEvents = Array.from({ length: 500 }, (_, i) => ({
      event: `event_${i}`,
      timestamp: i,
    }))
    store['kv:analytics'] = JSON.stringify(existingEvents)

    trackEvent('overflow_event')

    const events = getEvents()
    expect(events.length).toBeLessThanOrEqual(500)
    // The newest event should be present
    expect(events[events.length - 1].event).toBe('overflow_event')
  })
})

describe('convenience trackers', () => {
  it('trackGameStart records difficulty and characterCount', async () => {
    const { trackGameStart, getEvents } = await import('./analytics')
    trackGameStart('hard', 42)

    const events = getEvents()
    const gameStart = events.find((e) => e.event === 'game_start')
    expect(gameStart).toBeDefined()
    expect(gameStart!.data).toEqual({ difficulty: 'hard', characterCount: 42 })
  })

  it('trackGameEnd records won, difficulty, questionsAsked', async () => {
    const { trackGameEnd, getEvents } = await import('./analytics')
    trackGameEnd(true, 'medium', 8)

    const events = getEvents()
    const gameEnd = events.find((e) => e.event === 'game_end')
    expect(gameEnd).toBeDefined()
    expect(gameEnd!.data).toEqual({ won: true, difficulty: 'medium', questionsAsked: 8 })
  })

  it('trackShare records method', async () => {
    const { trackShare, getEvents } = await import('./analytics')
    trackShare('clipboard')

    const events = getEvents()
    const share = events.find((e) => e.event === 'share')
    expect(share!.data).toEqual({ method: 'clipboard' })
  })

  it('trackFeatureUse records feature', async () => {
    const { trackFeatureUse, getEvents } = await import('./analytics')
    trackFeatureUse('teaching_mode')

    const events = getEvents()
    const feature = events.find((e) => e.event === 'feature_use')
    expect(feature!.data).toEqual({ feature: 'teaching_mode' })
  })
})

describe('getEventCounts', () => {
  it('counts events by type', async () => {
    const { trackEvent, getEventCounts } = await import('./analytics')
    trackEvent('game_start')
    trackEvent('game_end')
    trackEvent('game_start')

    const counts = getEventCounts()
    expect(counts.game_start).toBe(2)
    expect(counts.game_end).toBe(1)
  })

  it('returns empty object for no events', async () => {
    const { getEventCounts } = await import('./analytics')
    expect(getEventCounts()).toEqual({})
  })
})

describe('getEventsSince', () => {
  it('filters events by timestamp', async () => {
    const { getEventsSince } = await import('./analytics')
    store['kv:analytics'] = JSON.stringify([
      { event: 'old', timestamp: 1000 },
      { event: 'new', timestamp: 3000 },
    ])

    const events = getEventsSince(2000)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('new')
  })
})

describe('clearAnalytics', () => {
  it('removes all analytics from localStorage', async () => {
    const { trackEvent, clearAnalytics, getEvents } = await import('./analytics')
    trackEvent('test')
    clearAnalytics()

    expect(getEvents()).toEqual([])
  })
})
