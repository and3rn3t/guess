/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Pages middleware for /admin* routes.
 *
 * Intercepts all requests to /admin* and /api/admin/* and enforces
 * HTTP Basic Auth. Credentials are stored in KV as `admin:basic-auth`
 * (plaintext base64 of "user:pass") to allow rotation without a deploy.
 *
 * Returns 401 + WWW-Authenticate on failure → triggers native browser dialog.
 */

interface Env {
  GUESS_KV: KVNamespace
}

/** Constant-time comparison to prevent timing attacks */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(a)),
    crypto.subtle.sign('HMAC', key, enc.encode(b)),
  ])
  const a32 = new Uint8Array(sigA)
  const b32 = new Uint8Array(sigB)
  let diff = 0
  for (let i = 0; i < a32.length; i++) diff |= a32[i] ^ b32[i]
  return diff === 0
}

function unauthorizedResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context
  const url = new URL(request.url)
  const path = url.pathname

  // Only gate /admin* paths (static assets under /assets/* are NOT under /admin*)
  const isAdminPath = path === '/admin' || path.startsWith('/admin/')

  if (!isAdminPath) {
    return next()
  }

  const kv = env.GUESS_KV
  if (!kv) {
    // No KV — fail closed (deny all)
    return unauthorizedResponse()
  }

  // Read stored credential (plaintext "user:pass" string stored in KV)
  const storedCredential = await kv.get('admin:basic-auth')
  if (!storedCredential) {
    return unauthorizedResponse()
  }

  // Parse Authorization header
  const authHeader = request.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Basic ')) {
    return unauthorizedResponse()
  }

  let providedCredential: string
  try {
    providedCredential = atob(authHeader.slice(6))
  } catch {
    return unauthorizedResponse()
  }

  const valid = await timingSafeEqual(providedCredential, storedCredential)

  // Rate limiting: track per-IP failures in KV (15-minute window, 10-attempt cap)
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown'
  const failKey = `auth:fails:${ip}`

  if (!valid) {
    const failCount = parseInt((await kv.get(failKey)) ?? '0', 10)
    await kv.put(failKey, String(failCount + 1), { expirationTtl: 900 })
    if (failCount + 1 >= 10) {
      return new Response('Too many failed login attempts. Try again later.', {
        status: 429,
        headers: { 'Content-Type': 'text/plain', 'Retry-After': '900' },
      })
    }
    return unauthorizedResponse()
  }

  // Clear failure counter on successful auth
  await kv.delete(failKey)

  return next()
}
