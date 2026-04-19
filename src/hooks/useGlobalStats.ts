import { useCallback, useEffect, useRef, useState } from 'react'
import { getUserId } from '@/lib/sync'
import type { Difficulty, GameHistoryEntry, GameHistoryStep } from '@/lib/types'

// ── Server response types ────────────────────────────────────

export interface GlobalStats {
  characters: number
  attributes: number
  questions: number
  characterAttributes: {
    total: number
    filled: number
    fillRate: number
  }
  byCategory: Array<{ category: string; count: number }>
  bySource: Array<{ source: string; count: number }>
  gameStats: {
    totalGames: number
    wins: number
    winRate: number
    avgQuestions: number
    avgPoolSize: number
    byDifficulty: Array<{
      difficulty: string
      games: number
      wins: number
      winRate: number
      avgQuestions: number
    }>
    recentGames: Array<{
      won: boolean
      difficulty: string
      questionsAsked: number
      poolSize: number
      timestamp: number
    }>
  } | null
}

interface HistoryResponse {
  games: Array<{
    id: string
    characterId: string
    characterName: string
    won: boolean
    difficulty: Difficulty
    questionsAsked: number
    poolSize: number
    steps: GameHistoryStep[]
    timestamp: number
  }>
  total: number
}

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

  const headers = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
  }), [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/stats', { headers: headers() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as GlobalStats
      cachedStats = data
      setStats(data)
    } catch (e) {
      console.warn('Failed to fetch global stats:', e)
      setError('Failed to load global statistics')
    }
  }, [headers])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/history?limit=100', { headers: headers() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as HistoryResponse

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
  }, [headers])

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
