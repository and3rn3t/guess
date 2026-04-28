import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameHistoryEntry } from '@/lib/types'
import { GlobalStatsSchema, HistoryApiResponseSchema } from '@/lib/schemas'
import type { z } from 'zod'

// ── Server response types ────────────────────────────────────

export type GlobalStats = z.infer<typeof GlobalStatsSchema>

// ── Module-level cache (stale-while-revalidate) ─────────────

const CACHE_TTL_MS = 60_000 // 60 seconds

let cachedStats: GlobalStats | null = null
let cachedHistory: { entries: GameHistoryEntry[]; total: number } | null = null
let lastFetchTime = 0

// ── Hook ─────────────────────────────────────────────────────

export function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats | null>(cachedStats)
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>(
    cachedHistory?.entries ?? []
  )
  const [gamesPlayed, setGamesPlayed] = useState(cachedHistory?.total ?? 0)
  const hasFreshCache = cachedStats !== null && Date.now() - lastFetchTime < CACHE_TTL_MS
  const [loading, setLoading] = useState(!hasFreshCache)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/stats', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = GlobalStatsSchema.parse(await res.json())
      cachedStats = data
      setStats(data)
    } catch (e) {
      console.warn('Failed to fetch global stats:', e)
      setError('Failed to load global statistics')
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/history?limit=100', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = HistoryApiResponseSchema.parse(await res.json())

      const entries: GameHistoryEntry[] = data.games.map((g) => ({
        id: g.id,
        characterId: g.characterId,
        characterName: g.characterName,
        won: g.won,
        timestamp: g.timestamp,
        difficulty: g.difficulty,
        totalQuestions: g.questionsAsked,
        steps: g.steps,
      }))

      cachedHistory = { entries, total: data.total }
      setGameHistory(entries)
      setGamesPlayed(data.total)
    } catch (e) {
      console.warn('Failed to fetch game history:', e)
      // Non-critical — stats still usable without history
    }
  }, [])

  // Initial fetch on mount (stale-while-revalidate)
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const isCacheFresh = cachedStats !== null && Date.now() - lastFetchTime < CACHE_TTL_MS

    const load = async () => {
      if (!isCacheFresh) setLoading(true)
      await Promise.all([fetchStats(), fetchHistory()])
      lastFetchTime = Date.now()
      setLoading(false)
    }

    if (isCacheFresh) {
      // Revalidate in background — state already initialized from cache
      Promise.all([fetchStats(), fetchHistory()]).then(() => {
        lastFetchTime = Date.now()
      })
    } else {
      load()
    }
  }, [fetchStats, fetchHistory])

  // Refresh after a game completes (bypasses cache)
  const refresh = useCallback(async () => {
    await Promise.all([fetchStats(), fetchHistory()])
    lastFetchTime = Date.now()
  }, [fetchStats, fetchHistory])

  return {
    stats,
    gameHistory,
    gamesPlayed,
    loading,
    error,
    refresh,
  }
}
