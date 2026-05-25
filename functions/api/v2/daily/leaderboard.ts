import {
  d1Query,
  type Env,
  errorResponse,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  withRequestId,
  withSetCookie,
  logError,
} from '../../_helpers'
import { getUtcDateKey, toUserLabel } from './_shared'

interface LeaderboardRow {
  user_id: string
  won: number
  questions_asked: number
  completed_at: number
}

function isMissingDailyResultsTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('no such table: daily_results')
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parseLeaderboardLimit(value: string | null): number | null {
  if (value === null) return 25
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
    return null
  }
  return parsed
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request)
  const respond = (response: Response): Response => withRequestId(response, requestId)

  try {
    const db = context.env.GUESS_DB
    if (!db) return respond(errorResponse('D1 not configured', 503))

    const url = new URL(context.request.url)
    const date = url.searchParams.get('date') ?? getUtcDateKey()
    if (!isValidDateKey(date)) return respond(errorResponse('Invalid date query parameter', 400))
    const limit = parseLeaderboardLimit(url.searchParams.get('limit'))
    if (limit === null) return respond(errorResponse('Invalid limit query parameter', 400))

    const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)

    let rows: LeaderboardRow[] = []
    try {
      rows = await d1Query<LeaderboardRow>(
        db,
        `SELECT user_id, won, questions_asked, completed_at
           FROM daily_results
          WHERE date = ?
          ORDER BY won DESC, questions_asked ASC, completed_at ASC
          LIMIT ?`,
        [date, limit],
      )
    } catch (error) {
      if (!isMissingDailyResultsTableError(error)) throw error
      context.waitUntil(
        logError(
          context.env.GUESS_DB,
          'daily.leaderboard',
          'warn',
          'daily_results table missing; returning empty leaderboard',
          error,
          { path: '/api/v2/daily/leaderboard', method: 'GET', requestId },
        ),
      )
    }

    const leaderboard = rows.map((row, idx) => ({
      rank: idx + 1,
      userLabel: toUserLabel(row.user_id),
      won: row.won === 1,
      questionsAsked: row.questions_asked,
      completedAt: row.completed_at,
      isYou: row.user_id === userId,
    }))

    return respond(withSetCookie(jsonResponse({ date, leaderboard }), setCookieHeader))
  } catch (error) {
    context.waitUntil(
      logError(
        context.env.GUESS_DB,
        'daily.leaderboard',
        'error',
        'Failed to load daily challenge leaderboard',
        error,
        { path: '/api/v2/daily/leaderboard', method: 'GET', requestId },
      ),
    )
    return respond(internalErrorResponse(requestId))
  }
}
