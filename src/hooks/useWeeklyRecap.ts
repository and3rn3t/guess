import { useMemo } from 'react'
import type { GameHistoryEntry } from '@/lib/types'

export interface WeeklyRecap {
  /** The Monday this recap covers (YYYY-MM-DD) */
  weekStart: string
  gamesPlayed: number
  wins: number
  winRate: number
  avgQuestions: number
  /** Character that required the most questions (or null if no wins) */
  hardestCharacter: string | null
  hardestQuestions: number
}

/**
 * Returns a weekly recap for the previous calendar week (Mon–Sun),
 * or null if no games were played that week.
 * Only computed/shown on Mondays.
 */
export function useWeeklyRecap(
  gameHistory: GameHistoryEntry[] | null,
): WeeklyRecap | null {
  return useMemo(() => {
    if (!gameHistory || gameHistory.length === 0) return null

    const now = new Date()
    // Only surface on Mondays (day 1)
    if (now.getDay() !== 1) return null

    // Find the Monday of last week
    const dayMs = 86_400_000
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const lastMonday = todayMidnight - 7 * dayMs
    const lastSunday = todayMidnight - dayMs // end of last week = yesterday midnight → before today

    const weekGames = gameHistory.filter(
      (g) => g.timestamp >= lastMonday && g.timestamp < todayMidnight,
    )
    if (weekGames.length === 0) return null

    const wins = weekGames.filter((g) => g.won)
    const winRate = wins.length / weekGames.length

    const avgQuestions =
      weekGames.reduce((sum, g) => sum + g.steps.length, 0) / weekGames.length

    // Hardest character — won game that took the most questions
    const hardestWin = wins.reduce<GameHistoryEntry | null>((best, g) => {
      if (!best || g.steps.length > best.steps.length) return g
      return best
    }, null)

    const weekStart = new Date(lastMonday)
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`

    void lastSunday // used for date range but not separately referenced

    return {
      weekStart: weekStartStr,
      gamesPlayed: weekGames.length,
      wins: wins.length,
      winRate,
      avgQuestions: Math.round(avgQuestions * 10) / 10,
      hardestCharacter: hardestWin?.characterName ?? null,
      hardestQuestions: hardestWin?.steps.length ?? 0,
    }
  }, [gameHistory])
}
