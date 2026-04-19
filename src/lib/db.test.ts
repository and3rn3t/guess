import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { addGameEntry, getGameHistory, clearGameHistory, addAnalyticsEvent, getAnalyticsSince, clearAnalyticsDb } from './db'
import type { GameHistoryEntry } from './types'
import type { AnalyticsEvent } from './db'

function createEntry(overrides?: Partial<GameHistoryEntry>): GameHistoryEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 8)}`,
    characterId: 'mario',
    characterName: 'Mario',
    won: true,
    timestamp: Date.now(),
    difficulty: 'medium',
    totalQuestions: 5,
    steps: [{ questionText: 'Human?', attribute: 'isHuman', answer: 'yes' }],
    ...overrides,
  }
}

// Clean up IndexedDB between tests
beforeEach(async () => {
  await clearGameHistory().catch(() => {})
  await clearAnalyticsDb().catch(() => {})
})

afterEach(async () => {
  await clearGameHistory().catch(() => {})
  await clearAnalyticsDb().catch(() => {})
})

describe('Game History', () => {
  it('starts with empty history', async () => {
    const history = await getGameHistory()
    expect(history).toEqual([])
  })

  it('adds and retrieves a game entry', async () => {
    const entry = createEntry({ id: 'test-1' })
    await addGameEntry(entry)

    const history = await getGameHistory()
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe('test-1')
    expect(history[0].characterName).toBe('Mario')
  })

  it('returns entries in reverse timestamp order', async () => {
    await addGameEntry(createEntry({ id: 'old', timestamp: 1000 }))
    await addGameEntry(createEntry({ id: 'new', timestamp: 2000 }))

    const history = await getGameHistory()
    expect(history[0].id).toBe('new')
    expect(history[1].id).toBe('old')
  })

  it('clears all history', async () => {
    await addGameEntry(createEntry())
    await addGameEntry(createEntry())
    await clearGameHistory()

    const history = await getGameHistory()
    expect(history).toEqual([])
  })

  it('stores all fields correctly', async () => {
    const entry = createEntry({
      id: 'full-test',
      characterId: 'link',
      characterName: 'Link',
      won: false,
      difficulty: 'hard',
      totalQuestions: 10,
      steps: [
        { questionText: 'Human?', attribute: 'isHuman', answer: 'yes' },
        { questionText: 'Weapons?', attribute: 'usesWeapons', answer: 'yes' },
      ],
    })
    await addGameEntry(entry)

    const [retrieved] = await getGameHistory()
    expect(retrieved.characterId).toBe('link')
    expect(retrieved.won).toBe(false)
    expect(retrieved.difficulty).toBe('hard')
    expect(retrieved.steps).toHaveLength(2)
  })
})

describe('Analytics', () => {
  it('adds and retrieves analytics events', async () => {
    const event: AnalyticsEvent = {
      event: 'game_start',
      timestamp: Date.now(),
      data: { difficulty: 'medium' },
    }
    await addAnalyticsEvent(event)

    const events = await getAnalyticsSince(0)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('game_start')
  })

  it('filters events by timestamp', async () => {
    await addAnalyticsEvent({ event: 'old', timestamp: 1000 })
    await addAnalyticsEvent({ event: 'new', timestamp: 3000 })

    const events = await getAnalyticsSince(2000)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('new')
  })

  it('clears analytics', async () => {
    await addAnalyticsEvent({ event: 'test', timestamp: Date.now() })
    await clearAnalyticsDb()

    const events = await getAnalyticsSince(0)
    expect(events).toEqual([])
  })
})
