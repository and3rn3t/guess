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
    const { trackEvent } = await import('./analytics')
    trackEvent('test_event')

    const raw = store['kv:analytics']
    const events = JSON.parse(raw)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('test_event')
    expect(events[0].timestamp).toBeGreaterThan(0)
  })

  it('stores event data', async () => {
    const { trackEvent } = await import('./analytics')
    trackEvent('test_event', { key: 'value', num: 42 })

    const events = JSON.parse(store['kv:analytics'])
    expect(events[0].data).toEqual({ key: 'value', num: 42 })
  })

  it('appends to existing events', async () => {
    const { trackEvent } = await import('./analytics')
    trackEvent('event_1')
    trackEvent('event_2')

    const events = JSON.parse(store['kv:analytics'])
    expect(events).toHaveLength(2)
  })

  it('caps at MAX_ANALYTICS_EVENTS', async () => {
    const { trackEvent } = await import('./analytics')
    // Pre-fill with 500 events
    const existingEvents = Array.from({ length: 500 }, (_, i) => ({
      event: `event_${i}`,
      timestamp: i,
    }))
    store['kv:analytics'] = JSON.stringify(existingEvents)

    trackEvent('overflow_event')

    const events = JSON.parse(store['kv:analytics'])
    expect(events.length).toBeLessThanOrEqual(500)
    // The newest event should be present
    expect(events[events.length - 1].event).toBe('overflow_event')
  })
})

describe('convenience trackers', () => {
  it('trackGameStart records difficulty and characterCount', async () => {
    const { trackGameStart } = await import('./analytics')
    trackGameStart('hard', 42)

    const events = JSON.parse(store['kv:analytics'])
    const gameStart = events.find((e: { event: string }) => e.event === 'game_start')
    expect(gameStart).toBeDefined()
    expect(gameStart!.data).toEqual({ difficulty: 'hard', characterCount: 42 })
  })

  it('trackGameEnd records won, difficulty, questionsAsked', async () => {
    const { trackGameEnd } = await import('./analytics')
    trackGameEnd(true, 'medium', 8)

    const events = JSON.parse(store['kv:analytics'])
    const gameEnd = events.find((e: { event: string }) => e.event === 'game_end')
    expect(gameEnd).toBeDefined()
    expect(gameEnd!.data).toEqual({ won: true, difficulty: 'medium', questionsAsked: 8 })
  })

  it('trackShare records method', async () => {
    const { trackShare } = await import('./analytics')
    trackShare('clipboard')

    const events = JSON.parse(store['kv:analytics'])
    const share = events.find((e: { event: string }) => e.event === 'share')
    expect(share!.data).toEqual({ method: 'clipboard' })
  })

  it('trackFeatureUse records feature', async () => {
    const { trackFeatureUse } = await import('./analytics')
    trackFeatureUse('teaching_mode')

    const events = JSON.parse(store['kv:analytics'])
    const feature = events.find((e: { event: string }) => e.event === 'feature_use')
    expect(feature!.data).toEqual({ feature: 'teaching_mode' })
  })
})
