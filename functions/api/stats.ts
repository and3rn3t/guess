import { defineHandler } from './_handler'
import {
  errorResponse,
  jsonResponse,
  kvGetArray,
  kvGetObject,
  kvPut,
  parseJsonBody,
} from './_helpers'

interface CharacterStats {
  characterId: string
  timesPlayed: number
  timesGuessed: number
  totalQuestions: number
  wins: number
  losses: number
  byDifficulty: Record<string, { played: number; won: number }>
}

function emptyStats(characterId: string): CharacterStats {
  return {
    characterId,
    timesPlayed: 0,
    timesGuessed: 0,
    totalQuestions: 0,
    wins: 0,
    losses: 0,
    byDifficulty: {
      easy: { played: 0, won: 0 },
      medium: { played: 0, won: 0 },
      hard: { played: 0, won: 0 },
    },
  }
}

export const onRequestGet = defineHandler(
  { name: 'stats', requireUser: false },
  async ({ env, url }) => {
    const kv = env.GUESS_KV
    const characterId = url.searchParams.get('characterId')

    if (characterId) {
      const stats =
        (await kvGetObject<CharacterStats>(kv, `stats:${characterId}`)) ||
        emptyStats(characterId)
      return jsonResponse(stats)
    }

    const leaderboard = await kvGetArray<CharacterStats>(kv, 'stats:leaderboard')
    return jsonResponse(leaderboard)
  },
)

export const onRequestPost = defineHandler(
  { name: 'stats', rateLimit: 30 },
  async ({ env, request }) => {
    const body = await parseJsonBody<{
      characterId?: string
      won?: boolean
      questionsAsked?: number
      difficulty?: string
    }>(request)

    if (!body) return errorResponse('Invalid JSON body', 400)

    const characterId = body.characterId
    if (!characterId || typeof characterId !== 'string') {
      return errorResponse('Missing characterId', 400)
    }
    if (typeof body.won !== 'boolean') {
      return errorResponse('Missing or invalid "won" field', 400)
    }
    if (typeof body.questionsAsked !== 'number' || body.questionsAsked < 0) {
      return errorResponse('Missing or invalid "questionsAsked"', 400)
    }

    const kv = env.GUESS_KV
    const key = `stats:${characterId}`
    const stats =
      (await kvGetObject<CharacterStats>(kv, key)) || emptyStats(characterId)

    stats.timesPlayed++
    stats.totalQuestions += body.questionsAsked
    if (body.won) {
      stats.wins++
      stats.timesGuessed++
    } else {
      stats.losses++
    }

    const diff = body.difficulty || 'medium'
    if (!stats.byDifficulty[diff]) {
      stats.byDifficulty[diff] = { played: 0, won: 0 }
    }
    stats.byDifficulty[diff].played++
    if (body.won) stats.byDifficulty[diff].won++

    await kvPut(kv, key, stats)

    // Update leaderboard (simple: maintain top 20 by timesPlayed)
    const leaderboard = await kvGetArray<CharacterStats>(kv, 'stats:leaderboard')
    const idx = leaderboard.findIndex((s) => s.characterId === characterId)
    if (idx >= 0) leaderboard[idx] = stats
    else leaderboard.push(stats)
    leaderboard.sort((a, b) => b.timesPlayed - a.timesPlayed)
    await kvPut(kv, 'stats:leaderboard', leaderboard.slice(0, 20))

    return jsonResponse({ success: true })
  },
)
