import {
  type Env,
  getUserId,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetObject,
  kvPut,
} from './_helpers'

interface UserData {
  userId: string
  settings: Record<string, unknown>
  gameStats: Record<string, unknown>
  lastSync: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const url = new URL(context.request.url)
  const userId = url.searchParams.get('userId')
  if (!userId) return errorResponse('Missing userId parameter', 400)

  const data = await kvGetObject<UserData>(kv, `user:${userId}`)
  if (!data) return jsonResponse({ userId, settings: {}, gameStats: {}, lastSync: 0 })

  return jsonResponse(data)
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

  const userId = body.userId || getUserId(context.request)
  if (!userId || userId === 'anonymous') {
    return errorResponse('Missing userId', 400)
  }

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

  return jsonResponse({ success: true, lastSync: updated.lastSync })
}
