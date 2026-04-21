import {
  type Env,
  getOrCreateUserId,
  withSetCookie,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetObject,
  kvPut,
} from './_helpers'

const DEPRECATION_HEADERS = {
  Deprecation: 'true',
  Sunset: 'Wed, 01 Jan 2027 00:00:00 GMT',
}

interface UserData {
  userId: string
  settings: Record<string, unknown>
  gameStats: Record<string, unknown>
  lastSync: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  try {
    const url = new URL(context.request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return errorResponse('Missing userId parameter', 400)

    const data = await kvGetObject<UserData>(kv, `user:${userId}`)
    const payload = data || { userId, settings: {}, gameStats: {}, lastSync: 0 }
    const response = jsonResponse(payload)
    const res = new Response(response.body, response)
    Object.entries(DEPRECATION_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
    return res
  } catch (e) {
    console.error('sync GET error:', e)
    return errorResponse('Internal server error', 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{
    userId?: string
    settings?: Record<string, unknown>
    gameStats?: Record<string, unknown>
  }>(context.request)

  if (!body) return errorResponse('Invalid JSON body', 400)

  const { userId: cookieUserId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  const userId = body.userId || cookieUserId
  if (!userId || userId === 'anonymous') {
    return errorResponse('Missing userId', 400)
  }

  try {
    const existing = (await kvGetObject<UserData>(kv, `user:${userId}`)) || {
      userId,
      settings: {},
      gameStats: {},
      lastSync: 0,
    }

    // Merge (shallow) — new values overwrite old
    const updated: UserData = {
      userId,
      settings: { ...existing.settings, ...body.settings },
      gameStats: { ...existing.gameStats, ...body.gameStats },
      lastSync: Date.now(),
    }

    await kvPut(kv, `user:${userId}`, updated)

    return withSetCookie(
      jsonResponse({ success: true, lastSync: updated.lastSync }),
      setCookieHeader
    )
  } catch (e) {
    console.error('sync POST error:', e)
    return errorResponse('Internal server error', 500)
  }
}
