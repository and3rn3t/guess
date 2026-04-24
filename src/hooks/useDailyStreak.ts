import { useMemo } from 'react'
import type { GameHistoryEntry } from '@/lib/types'

/**
 * Returns the current consecutive-day win streak from game history.
 *
 * A "day" is a calendar date in the user's local timezone.
 * Only games where `won === true` are counted.
 * The streak continues backwards from today (or yesterday) without gaps.
 */
export function useDailyStreak(gameHistory: GameHistoryEntry[] | null): number {
  return useMemo(() => {
    if (!gameHistory || gameHistory.length === 0) return 0

    // Collect unique calendar dates (YYYY-MM-DD) where the user WON
    const wonDates = new Set<string>()
    for (const entry of gameHistory) {
      if (entry.won) {
        wonDates.add(toLocalDate(entry.timestamp))
      }
    }

    if (wonDates.size === 0) return 0

    const today = toLocalDate(Date.now())
    const yesterday = toLocalDate(Date.now() - 86_400_000)

    // Streak must include today or yesterday; otherwise it's broken
    if (!wonDates.has(today) && !wonDates.has(yesterday)) return 0

    // Walk backwards from whichever anchor we found
    let cursor = wonDates.has(today) ? today : yesterday
    let streak = 0

    while (wonDates.has(cursor)) {
      streak++
      cursor = toLocalDate(parseDateStr(cursor) - 86_400_000)
    }

    return streak
  }, [gameHistory])
}

function toLocalDate(timestampMs: number): string {
  const d = new Date(timestampMs)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateStr(dateStr: string): number {
  // Parse as local midnight to avoid timezone offset issues
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
