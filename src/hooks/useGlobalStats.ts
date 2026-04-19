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

// ── Hook ─────────────────────────────────────────────────────

export function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([])
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [loading, setLoading] = useState(true)
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

      setGameHistory(entries)
      setGamesPlayed(data.total)
    } catch (e) {
      console.warn('Failed to fetch game history:', e)
      // Non-critical — stats still usable without history
    }
  }, [headers])

  // Initial fetch on mount
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const load = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchHistory()])
      setLoading(false)
    }
    load()
  }, [fetchStats, fetchHistory])

  // Refresh after a game completes
  const refresh = useCallback(async () => {
    await Promise.all([fetchStats(), fetchHistory()])
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
