import { useCallback, useEffect, useState } from 'react'

export interface DailyChallengeStatus {
  date: string
  characterId: string
  /** Only present after completing today's challenge */
  characterName: string | null
  imageUrl: string | null
  completed: boolean
  won: boolean | null
  questionsAsked: number | null
}

interface UseDailyChallengeReturn {
  status: DailyChallengeStatus | null
  loading: boolean
  /** Record that the user finished today's challenge */
  recordCompletion: (won: boolean, questionsAsked: number) => Promise<void>
  /** Re-fetch the current status */
  refresh: () => Promise<void>
}

export function useDailyChallenge(): UseDailyChallengeReturn {
  const [status, setStatus] = useState<DailyChallengeStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/daily', { credentials: 'same-origin' })
      if (!res.ok) return
      const data = (await res.json()) as DailyChallengeStatus
      setStatus(data)
    } catch {
      // Network error — silently fail, daily challenge is optional UX
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const recordCompletion = useCallback(
    async (won: boolean, questionsAsked: number) => {
      try {
        await fetch('/api/v2/daily', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ won, questionsAsked }),
        })
        // Refresh status so UI reflects completion immediately
        await fetchStatus()
      } catch {
        // Non-critical — don't surface to user
      }
    },
    [fetchStatus]
  )

  return { status, loading, recordCompletion, refresh: fetchStatus }
}
