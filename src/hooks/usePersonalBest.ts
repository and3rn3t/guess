import { useKV } from './useKV'
import type { Difficulty } from '@/lib/types'

type PersonalBests = Partial<Record<Difficulty, number>>

/**
 * Tracks the fewest questions needed to win per difficulty, persisted in
 * localStorage. Returns `personalBest` (null if never won) and `updateBest`
 * which sets a new best when `questionsAsked` improves on the current record.
 */
export function usePersonalBest(difficulty: Difficulty) {
  const [bests, setBests] = useKV<PersonalBests>('personal-bests', {})

  const personalBest = bests[difficulty] ?? null

  /**
   * Call with the number of questions asked when the player wins.
   * Returns true if this is a new personal best.
   */
  function updateBest(questionsAsked: number): boolean {
    const isNew = personalBest === null || questionsAsked < personalBest
    if (isNew) {
      setBests((prev) => ({ ...prev, [difficulty]: questionsAsked }))
    }
    return isNew
  }

  return { personalBest, updateBest }
}
