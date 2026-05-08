import type { NetworkAdapter } from '@guess/app-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { endpoint } from './apiBase'
import {
  deriveMobileInsightsSnapshot,
  type MobileGlobalStats,
  type MobileHistoryEntry,
  type MobileInsightsSnapshot,
  type MobileStatsByDifficulty,
} from './mobileInsights'

interface StatsApiResponse {
  gameStats: {
    totalGames: number
    wins: number
    winRate: number
    avgQuestions: number
    byDifficulty: Array<{
      difficulty: string
      games: number
      wins: number
      winRate: number
      avgQuestions: number
    }>
  } | null
}

interface HistoryApiResponse {
  games: Array<{
    id: string
    characterId: string
    characterName: string
    won: boolean
    difficulty: string
    questionsAsked: number
    timestamp: number
    steps: Array<{
      questionId?: string
      questionText: string
      attribute: string
      answer: 'yes' | 'no' | 'unknown'
    }>
  }>
  total: number
}

export interface MobilePlayerInsightsState {
  snapshot: MobileInsightsSnapshot
  history: MobileHistoryEntry[]
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

export interface MobilePlayerInsightsActions {
  refresh: () => Promise<void>
}

const CACHE_TTL_MS = 60_000

let cachedStats: MobileGlobalStats | null = null
let cachedHistory: MobileHistoryEntry[] = []
let cachedTotal = 0
let cachedAt = 0

const EMPTY_SNAPSHOT = deriveMobileInsightsSnapshot(null, [])

const toStatsModel = (response: StatsApiResponse): MobileGlobalStats | null => {
  if (!response.gameStats) {
    return null
  }

  const byDifficulty: MobileStatsByDifficulty[] = response.gameStats.byDifficulty.map((row) => ({
    difficulty: row.difficulty,
    games: row.games,
    wins: row.wins,
    winRate: row.winRate,
    avgQuestions: row.avgQuestions,
  }))

  return {
    totalGames: response.gameStats.totalGames,
    wins: response.gameStats.wins,
    winRate: response.gameStats.winRate,
    avgQuestions: response.gameStats.avgQuestions,
    byDifficulty,
  }
}

const toHistoryModel = (response: HistoryApiResponse): MobileHistoryEntry[] =>
  response.games.map((game) => ({
    id: game.id,
    characterId: game.characterId,
    characterName: game.characterName,
    won: game.won,
    timestamp: game.timestamp,
    difficulty: game.difficulty,
    totalQuestions: game.questionsAsked,
    steps: game.steps,
  }))

export const useMobilePlayerInsights = (
  network: NetworkAdapter,
): MobilePlayerInsightsState & MobilePlayerInsightsActions => {
  const hasFreshCache = cachedAt > 0 && Date.now() - cachedAt < CACHE_TTL_MS
  const [stats, setStats] = useState<MobileGlobalStats | null>(cachedStats)
  const [history, setHistory] = useState<MobileHistoryEntry[]>(cachedHistory)
  const [loading, setLoading] = useState(!hasFreshCache)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedAt || null)
  const fetchedRef = useRef(false)

  const fetchStats = useCallback(async (): Promise<MobileGlobalStats | null> => {
    const response = await network.fetchJson<StatsApiResponse>(endpoint('/api/v2/stats'))
    return toStatsModel(response)
  }, [network])

  const fetchHistory = useCallback(async (): Promise<{ entries: MobileHistoryEntry[]; total: number }> => {
    const response = await network.fetchJson<HistoryApiResponse>(endpoint('/api/v2/history?limit=100'))
    return {
      entries: toHistoryModel(response),
      total: response.total,
    }
  }, [network])

  const load = useCallback(
    async (useLoading: boolean): Promise<void> => {
      if (useLoading) {
        setLoading(true)
      }

      try {
        const [nextStats, nextHistory] = await Promise.all([fetchStats(), fetchHistory()])
        cachedStats = nextStats
        cachedHistory = nextHistory.entries
        cachedTotal = nextHistory.total
        cachedAt = Date.now()

        setStats(nextStats)
        setHistory(nextHistory.entries)
        setLastUpdated(cachedAt)
        setError(null)
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'Failed to load mobile insights'
        setError(message)
      } finally {
        if (useLoading) {
          setLoading(false)
        }
      }
    },
    [fetchHistory, fetchStats],
  )

  useEffect(() => {
    if (fetchedRef.current) {
      return
    }
    fetchedRef.current = true

    if (hasFreshCache) {
      void load(false)
      return
    }

    void load(true)
  }, [hasFreshCache, load])

  const refresh = useCallback(async (): Promise<void> => {
    await load(true)
  }, [load])

  const snapshot = useMemo(() => {
    const sourceStats =
      stats === null && cachedTotal > 0
        ? {
            totalGames: cachedTotal,
            wins: history.filter((entry) => entry.won).length,
            winRate: history.length === 0 ? 0 : Math.round((history.filter((entry) => entry.won).length / cachedTotal) * 1000) / 10,
            avgQuestions:
              history.length === 0
                ? 0
                : Math.round((history.reduce((sum, entry) => sum + entry.totalQuestions, 0) / history.length) * 10) / 10,
            byDifficulty: [],
          }
        : stats

    return deriveMobileInsightsSnapshot(sourceStats, history)
  }, [history, stats])

  return {
    snapshot: history.length === 0 && stats === null ? EMPTY_SNAPSHOT : snapshot,
    history,
    loading,
    error,
    lastUpdated,
    refresh,
  }
}