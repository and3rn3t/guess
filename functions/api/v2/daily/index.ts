import {
  d1Run,
  type Env,
  errorResponse,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  parseJsonBody,
  withRequestId,
  withSetCookie,
  logError,
} from '../../_helpers'
import { getDailyCompletion, getUtcDateKey, pickDailyCharacter } from './_shared'

interface DailyPostBody {
  won?: boolean
  questionsAsked?: number
}

function isMissingDailyResultsTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('no such table: daily_results')
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request)
  const respond = (response: Response): Response => withRequestId(response, requestId)

  try {
    const db = context.env.GUESS_DB
    if (!db) return respond(errorResponse('D1 not configured', 503))

    const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
    const date = getUtcDateKey()
    const dailyCharacter = await pickDailyCharacter(db, date)
    if (!dailyCharacter) {
      return respond(withSetCookie(errorResponse('No eligible daily challenge character', 503), setCookieHeader))
    }

    const completion = await getDailyCompletion(db, date, userId)

    const payload = {
      date,
      characterId: dailyCharacter.id,
      featuredCharacter: {
        id: dailyCharacter.id,
        name: dailyCharacter.name,
        imageUrl: dailyCharacter.image_url,
      },
      completed: completion != null,
      result: completion
        ? {
            won: completion.won === 1,
            questionsAsked: completion.questions_asked,
            completedAt: completion.completed_at,
          }
        : null,
      revealedCharacter: completion
        ? {
            id: dailyCharacter.id,
            name: dailyCharacter.name,
            imageUrl: dailyCharacter.image_url,
          }
        : null,
    }

    return respond(withSetCookie(jsonResponse(payload), setCookieHeader))
  } catch (error) {
    await logError(
      context.env.GUESS_DB,
      'daily.get',
      'error',
      'Failed to load daily challenge status',
      error,
      { path: '/api/v2/daily', method: 'GET', requestId },
    )
    return respond(internalErrorResponse(requestId))
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request)
  const respond = (response: Response): Response => withRequestId(response, requestId)

  try {
    const db = context.env.GUESS_DB
    if (!db) return respond(errorResponse('D1 not configured', 503))

    const body = await parseJsonBody<DailyPostBody>(context.request)
    if (!body || typeof body.won !== 'boolean' || typeof body.questionsAsked !== 'number') {
      return respond(errorResponse('Invalid request body', 400))
    }

    const questionsAsked = Math.max(1, Math.floor(body.questionsAsked))
    const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
    const date = getUtcDateKey()
    const dailyCharacter = await pickDailyCharacter(db, date)
    if (!dailyCharacter) {
      return respond(withSetCookie(errorResponse('No eligible daily challenge character', 503), setCookieHeader))
    }

    // Idempotent: first write wins for each (date, user).
    try {
      await d1Run(
        db,
        `INSERT OR IGNORE INTO daily_results (date, user_id, character_id, won, questions_asked, completed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [date, userId, dailyCharacter.id, body.won ? 1 : 0, questionsAsked, Date.now()],
      )
    } catch (error) {
      if (!isMissingDailyResultsTableError(error)) throw error
      await logError(
        context.env.GUESS_DB,
        'daily.post',
        'warn',
        'daily_results table missing; skipping daily result persistence',
        error,
        { path: '/api/v2/daily', method: 'POST', requestId },
      )
    }

    return respond(withSetCookie(jsonResponse({ ok: true, date, characterId: dailyCharacter.id }), setCookieHeader))
  } catch (error) {
    await logError(
      context.env.GUESS_DB,
      'daily.post',
      'error',
      'Failed to record daily challenge result',
      error,
      { path: '/api/v2/daily', method: 'POST', requestId },
    )
    return respond(internalErrorResponse(requestId))
  }
}
