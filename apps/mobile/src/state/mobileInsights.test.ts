import { describe, expect, it } from 'vitest'
import {
  deriveAchievements,
  deriveAchievementProgress,
  deriveDailyStreak,
  deriveMobileInsightsSnapshot,
  deriveQuestionHeatmap,
  deriveSuccessRates,
  type MobileGlobalStats,
  type MobileHistoryEntry,
} from './mobileInsights'

const baseNow = new Date(2026, 4, 7, 12, 0, 0).getTime()

const createEntry = (
  overrides: Partial<MobileHistoryEntry> & Pick<MobileHistoryEntry, 'id'>,
): MobileHistoryEntry => ({
  id: overrides.id,
  characterId: overrides.characterId ?? overrides.id,
  characterName: overrides.characterName ?? `Character ${overrides.id}`,
  won: overrides.won ?? true,
  timestamp: overrides.timestamp ?? baseNow,
  difficulty: overrides.difficulty ?? 'medium',
  totalQuestions: overrides.totalQuestions ?? 5,
  steps: overrides.steps ?? [],
})

describe('mobileInsights', () => {
  it('derives a consecutive streak from today backwards', () => {
    const history = [
      createEntry({ id: 'a', timestamp: baseNow, won: true }),
      createEntry({ id: 'b', timestamp: baseNow - 86_400_000, won: true }),
      createEntry({ id: 'c', timestamp: baseNow - 2 * 86_400_000, won: true }),
      createEntry({ id: 'd', timestamp: baseNow - 4 * 86_400_000, won: true }),
    ]

    expect(deriveDailyStreak(history, baseNow)).toBe(3)
  })

  it('unlocks achievements from history and volume thresholds', () => {
    const history = [
      createEntry({ id: 'a', totalQuestions: 4, won: true }),
      createEntry({ id: 'b', totalQuestions: 8, won: true }),
    ]

    expect(deriveAchievements(history, 3, 10).map((item) => item.id)).toEqual([
      'speed-demon',
      'hot-streak',
      'persistent',
    ])
  })

  it('reports progress for locked achievements', () => {
    const history = [
      createEntry({ id: 'a', won: true, totalQuestions: 4 }),
      createEntry({ id: 'b', won: false, totalQuestions: 8 }),
    ]

    const progress = deriveAchievementProgress(history, 2, 6)
    const hotStreak = progress.find((item) => item.achievement.id === 'hot-streak')
    const persistent = progress.find((item) => item.achievement.id === 'persistent')

    expect(hotStreak).toMatchObject({ unlocked: false, current: 2, target: 3 })
    expect(persistent).toMatchObject({ unlocked: false, current: 6, target: 10 })
  })

  it('builds heatmap buckets from question counts', () => {
    const history = [
      createEntry({ id: 'a', totalQuestions: 3, won: true }),
      createEntry({ id: 'b', totalQuestions: 7, won: false }),
      createEntry({ id: 'c', totalQuestions: 7, won: true }),
      createEntry({ id: 'd', totalQuestions: 18, won: false }),
    ]

    const heatmap = deriveQuestionHeatmap(history)
    expect(heatmap.find((cell) => cell.id === 'q1-5')).toMatchObject({ games: 1, wins: 1 })
    expect(heatmap.find((cell) => cell.id === 'q6-10')).toMatchObject({ games: 2, losses: 1 })
    expect(heatmap.find((cell) => cell.id === 'q16-20')).toMatchObject({ games: 1, losses: 1 })
  })

  it('prefers server success rates when stats are available', () => {
    const stats: MobileGlobalStats = {
      totalGames: 12,
      wins: 8,
      winRate: 66.7,
      avgQuestions: 8.2,
      byDifficulty: [
        { difficulty: 'medium', games: 7, wins: 5, winRate: 71.4, avgQuestions: 7.1 },
        { difficulty: 'hard', games: 5, wins: 3, winRate: 60, avgQuestions: 9.4 },
      ],
    }

    const rates = deriveSuccessRates(stats, [])
    expect(rates).toEqual([
      { id: 'medium', label: 'Medium', games: 7, wins: 5, winRate: 71.4, avgQuestions: 7.1 },
      { id: 'hard', label: 'Hard', games: 5, wins: 3, winRate: 60, avgQuestions: 9.4 },
    ])
  })

  it('produces a complete snapshot when only history is available', () => {
    const history = [
      createEntry({ id: 'a', won: true, totalQuestions: 4, difficulty: 'easy', timestamp: baseNow }),
      createEntry({ id: 'b', won: false, totalQuestions: 9, difficulty: 'hard', timestamp: baseNow - 86_400_000 }),
    ]

    const snapshot = deriveMobileInsightsSnapshot(null, history, baseNow)
    expect(snapshot.totalGames).toBe(2)
    expect(snapshot.wins).toBe(1)
    expect(snapshot.winRate).toBe(50)
    expect(snapshot.avgQuestions).toBe(6.5)
    expect(snapshot.successRates.map((item) => item.id)).toEqual(['easy', 'hard'])
    expect(snapshot.recentHistory).toHaveLength(2)
  })
})