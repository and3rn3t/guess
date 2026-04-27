/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Pages middleware for /admin* routes.
 *
 * Intercepts all requests to /admin* and /api/admin/* and enforces
 * HTTP Basic Auth. Credentials are stored in KV as `admin:basic-auth`.
 *
 * The KV value supports two formats so credentials can be rotated without
 * a deploy:
 *   1. `sha256:<hex-digest-of-"user:pass">` (preferred) — stores only a
 *      digest, so a KV read alone does not yield plaintext.
 *   2. plain `"user:pass"` (legacy) — still accepted for backward compat.
 *
 * To rotate to the hashed format, run:
 *   echo -n 'user:pass' | shasum -a 256 | awk '{print "sha256:"$1}'
 * and store that string in KV under `admin:basic-auth`.
 *
 * Returns 401 + WWW-Authenticate on failure → triggers native browser dialog.
 */

interface Env {
  GUESS_KV: KVNamespace
}

const HASH_PREFIX = 'sha256:'

/** Hex-encoded SHA-256 of the input string. */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
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

/**
 * Compare a provided "user:pass" credential against the KV-stored secret,
 * supporting both `sha256:<hex>` and plaintext formats. Always uses
 * timing-safe comparison.
 */
async function credentialMatches(provided: string, stored: string): Promise<boolean> {
  if (stored.startsWith(HASH_PREFIX)) {
    const expectedHex = stored.slice(HASH_PREFIX.length).trim().toLowerCase()
    const providedHex = await sha256Hex(provided)
    return timingSafeEqual(providedHex, expectedHex)
  }
  return timingSafeEqual(provided, stored)
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

  // Read stored credential — accepts `sha256:<hex>` or legacy plaintext.
  let storedCredential: string | null
  try {
    storedCredential = await kv.get('admin:basic-auth')
  } catch {
    // KV transient error — fail closed
    return unauthorizedResponse()
  }
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

  const valid = await credentialMatches(providedCredential, storedCredential)

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
