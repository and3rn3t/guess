import {
  d1Query,
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

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export const onRequestGet: PagesFunction = async (context) => {
  const requestId = getRequestId(context.request)
  const respond = (response: Response): Response => withRequestId(response, requestId)

  try {
    const db = context.env.GUESS_DB
    if (!db) return respond(errorResponse('D1 not configured', 503))

    const url = new URL(context.request.url)
    const date = url.searchParams.get('date') ?? getUtcDateKey()
    if (!isValidDateKey(date)) return respond(errorResponse('Invalid date query parameter', 400))

    const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)

    const rows = await d1Query<LeaderboardRow>(
      db,
      `SELECT user_id, won, questions_asked, completed_at
         FROM daily_results
        WHERE date = ?
        ORDER BY won DESC, questions_asked ASC, completed_at ASC
        LIMIT 20`,
      [date],
    )

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
    await logError(
      context.env.GUESS_DB,
      'daily.leaderboard',
      'error',
      'Failed to load daily challenge leaderboard',
      error,
      { path: '/api/v2/daily/leaderboard', method: 'GET', requestId },
    )
    return respond(internalErrorResponse(requestId))
  }
}
