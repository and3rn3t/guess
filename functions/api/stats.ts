import {
  type Env,
  getUserId,
  checkRateLimit,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetObject,
  kvPut,
  kvGetArray,
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  try {
    const url = new URL(context.request.url)
    const characterId = url.searchParams.get('characterId')

    if (characterId) {
      const stats = (await kvGetObject<CharacterStats>(kv, `stats:${characterId}`)) || emptyStats(characterId)
      return jsonResponse(stats)
    }

    const leaderboard = await kvGetArray<CharacterStats>(kv, 'stats:leaderboard')
    return jsonResponse(leaderboard)
  } catch (e) {
    console.error('stats GET error:', e)
    return errorResponse('Internal server error', 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{
    characterId?: string
    won?: boolean
    questionsAsked?: number
    difficulty?: string
  }>(context.request)

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

  const userId = getUserId(context.request)
  const { allowed } = await checkRateLimit(kv, userId, 'stats', 30)
  if (!allowed) return errorResponse('Rate limit exceeded', 429)

  try {
    const key = `stats:${characterId}`
    const stats = (await kvGetObject<CharacterStats>(kv, key)) || emptyStats(characterId)

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
  } catch (e) {
    console.error('stats POST error:', e)
    return errorResponse('Internal server error', 500)
  }
}
