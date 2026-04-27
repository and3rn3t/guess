import { defineHandler } from './_handler'
import {
  errorResponse,
  jsonResponse,
  kvGetObject,
  kvPut,
  parseJsonBody,
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

export const onRequestGet = defineHandler(
  { name: 'sync', requireUser: false },
  async ({ env, url }) => {
    const userId = url.searchParams.get('userId')
    if (!userId) return errorResponse('Missing userId parameter', 400)

    const data = await kvGetObject<UserData>(env.GUESS_KV, `user:${userId}`)
    const payload = data || { userId, settings: {}, gameStats: {}, lastSync: 0 }
    const response = jsonResponse(payload)
    const res = new Response(response.body, response)
    Object.entries(DEPRECATION_HEADERS).forEach(([k, v]) =>
      res.headers.set(k, v),
    )
    return res
  },
)

export const onRequestPost = defineHandler(
  { name: 'sync' },
  async ({ env, request, userId: cookieUserId }) => {
    const body = await parseJsonBody<{
      userId?: string
      settings?: Record<string, unknown>
      gameStats?: Record<string, unknown>
    }>(request)

    if (!body) return errorResponse('Invalid JSON body', 400)

    const userId = body.userId || cookieUserId
    if (!userId || userId === 'anonymous') {
      return errorResponse('Missing userId', 400)
    }

    const kv = env.GUESS_KV
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
  },
)
