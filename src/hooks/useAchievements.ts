import { useMemo } from 'react'
import type { GameHistoryEntry } from '@/lib/types'

export interface Achievement {
  id: string
  label: string
  emoji: string
  description: string
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'speed-demon',  label: 'Speed Demon',  emoji: '⚡', description: 'Win in 5 or fewer questions' },
  { id: 'hot-streak',   label: 'Hot Streak',   emoji: '🔥', description: 'Win 3 days in a row' },
  { id: 'week-warrior', label: 'Week Warrior', emoji: '🗓️', description: 'Win 7 days in a row' },
  { id: 'persistent',   label: 'Persistent',   emoji: '🎮', description: 'Play 10 or more games' },
  { id: 'veteran',      label: 'Veteran',      emoji: '🏅', description: 'Play 50 or more games' },
]

/**
 * Derives which achievements are earned from game history and streak.
 * All state is derived — no extra localStorage needed.
 */
export function useAchievements(
  gameHistory: GameHistoryEntry[] | null,
  streak: number,
  gamesPlayed: number,
): Achievement[] {
  return useMemo(() => {
    const earned: Achievement[] = []
    const entries = gameHistory ?? []

    // Speed Demon — won in ≤5 questions
    if (entries.some((g) => g.won && g.steps.length <= 5)) {
      earned.push(ALL_ACHIEVEMENTS[0])
    }

    // Hot Streak — daily streak ≥ 3
    if (streak >= 3) earned.push(ALL_ACHIEVEMENTS[1])

    // Week Warrior — daily streak ≥ 7
    if (streak >= 7) earned.push(ALL_ACHIEVEMENTS[2])

    // Persistent — 10+ games
    if (gamesPlayed >= 10) earned.push(ALL_ACHIEVEMENTS[3])

    // Veteran — 50+ games
    if (gamesPlayed >= 50) earned.push(ALL_ACHIEVEMENTS[4])

    return earned
  }, [gameHistory, streak, gamesPlayed])
}
