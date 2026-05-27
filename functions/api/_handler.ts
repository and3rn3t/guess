/**
 * Wrapper for Pages Function handlers that absorbs the four bits of boilerplate
 * every route in `functions/api/**` repeats:
 *
 *   1. D1-presence check (returns 503 when GUESS_DB is missing)
 *   2. Loading the signed-cookie user-id (and writing Set-Cookie on response)
 *   3. Per-user rate limit (when configured)
 *   4. try/catch around the handler with `logError(...)` and a 500 response
 *
 * Body parsing and field validation stay inline in each handler — those vary
 * too much between endpoints to dedupe without sacrificing type safety.
 *
 * Usage:
 *
 *   export const onRequestPost = defineHandler(
 *     { name: 'stats', rateLimit: 30 },
 *     async ({ env, request, userId }) => {
 *       const body = await parseJsonBody<{...}>(request)
 *       if (!body) return errorResponse('Invalid JSON body', 400)
 *       // ...business logic
 *       return jsonResponse({ success: true })
 *     },
 *   )
 *
 *   export const onRequestGet = defineHandler(
 *     { name: 'stats', requireUser: false },
 *     async ({ env, url }) => {
 *       const id = url.searchParams.get('characterId')
 *       // ...
 *     },
 *   )
 */
import {
  type Env,
  checkRateLimitDO,
  errorResponse,
  getActorId,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  logError,
  withRequestId,
  withSetCookie,
} from './_helpers'

export interface HandlerCtx {
  env: Env
  request: Request
  /** Pre-parsed `new URL(request.url)` for convenience. */
  url: URL
  waitUntil: (promise: Promise<unknown>) => void
  /**
   * Authenticated user-id when `requireUser !== false` (default).
   * Empty string when `requireUser: false`.
   */
  userId: string
}

export interface HandlerOptions {
  /** Used for log scope and as the rate-limit bucket key. */
  name: string
  /** When `true` (default), loads the signed-cookie user-id and writes Set-Cookie. */
  requireUser?: boolean
  /** Optional per-user rate limit (max requests per hour for the `name` bucket). */
  rateLimit?: number
}

export function defineHandler(
  options: HandlerOptions,
  handler: (ctx: HandlerCtx) => Promise<Response>,
): PagesFunction<Env> {
  const { name, requireUser = true, rateLimit } = options

  return async (context) => {
    const { env, request } = context
    const requestId = getRequestId(request)
    const actorId = getActorId(request)
    const url = new URL(request.url)

    const respond = (response: Response, setCookieHeader?: string): Response =>
      withRequestId(withSetCookie(response, setCookieHeader), requestId)

    try {
      let userId = ''
      let setCookieHeader: string | undefined

      if (requireUser) {
        const result = await getOrCreateUserId(request, env)
        userId = result.userId
        setCookieHeader = result.setCookieHeader
      }

      if (rateLimit !== undefined && userId) {
        const { allowed } = await checkRateLimitDO(env, userId, name, rateLimit)
        if (!allowed) {
          // Apply Set-Cookie to the 429 too — otherwise a freshly minted
          // user-id never reaches the client on rate-limited requests, and
          // the next attempt re-mints another fresh user.
          return respond(
            errorResponse('Rate limit exceeded', 429),
            setCookieHeader,
          )
        }
      }

      const response = await handler({
        env,
        request,
        url,
        waitUntil: context.waitUntil.bind(context),
        userId,
      })
      return respond(response, setCookieHeader)
    } catch (e) {
      console.error(`${name} handler error:`, e)
      context.waitUntil(
        logError(env, name, 'error', `${name} handler error`, e, {
          requestId,
          actorId,
          path: url.pathname,
          method: request.method,
          status: 500,
        }),
      )
      return respond(internalErrorResponse(requestId))
    }
  }
}
