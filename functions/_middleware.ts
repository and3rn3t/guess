/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Pages middleware.
 *
 * Two responsibilities:
 *   1. Gate /admin* + /api/admin* routes behind HTTP Basic Auth.
 *   2. Emit one Workers Analytics Engine data point per request to
 *      `WORKER_TAIL` (I.4 fallback — Pages doesn't support tail_consumers,
 *      so we time `next()` inline and write the same schema the Tail Worker
 *      would have produced).
 *
 * Admin credential is read from the `ADMIN_CREDENTIAL` Cloudflare secret
 * (no KV required). Supported formats:
 *   1. `sha256:<hex-digest-of-"user:pass">` (preferred) — stores only a
 *      digest, so a secret read alone does not yield plaintext.
 *   2. plain `"user:pass"` (legacy) — still accepted for backward compat.
 *
 * To generate the hashed format:
 *   echo -n 'user:pass' | shasum -a 256 | awk '{print "sha256:"$1}'
 * Store that string as the ADMIN_CREDENTIAL secret in the Cloudflare dashboard.
 *
 * Returns 401 + WWW-Authenticate on failure → triggers native browser dialog.
 */

import { isAdminPath } from './_admin_paths'
import {
  recordRequest,
  type AnalyticsEngineDataset,
} from './_request_metrics'

interface Env {
  ADMIN_CREDENTIAL?: string
  GUESS_DB: D1Database
  WORKER_TAIL?: AnalyticsEngineDataset
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
  const method = request.method
  const start = Date.now()

  // Wrap response generation so we can always emit one AE row per request,
  // including admin-auth rejections and uncaught exceptions.
  const finalize = (response: Response, errorMessage?: string): Response => {
    recordRequest(env.WORKER_TAIL, {
      path,
      method,
      status: response.status,
      wallMs: Date.now() - start,
      errorMessage,
    })
    return response
  }

  // Gate both the SPA admin shell (/admin*) and the admin JSON API
  // (/api/admin*). Static assets under /assets/* are NOT under either prefix
  // and are therefore unaffected. Predicate lives in `./_admin_paths` so the
  // SE.2 RBAC coverage audit can re-use it.
  const isAdmin = isAdminPath(path)

  if (!isAdmin) {
    try {
      return finalize(await next())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Re-throw so Pages still surfaces the 500 — telemetry is best-effort.
      finalize(new Response('Internal Error', { status: 500 }), msg)
      throw err
    }
  }

  const storedCredential = env.ADMIN_CREDENTIAL
  if (!storedCredential) {
    // Credential not configured — fail closed (deny all admin access)
    return finalize(unauthorizedResponse())
  }

  // Internal enrichment chain bypass — lets run.ts fire a new Worker
  // invocation without needing to store or replay Basic Auth credentials.
  // Only fires when the X-Internal-Chain-Token header is present.
  if (isAdmin && request.headers.has('X-Internal-Chain-Token')) {
    const token = request.headers.get('X-Internal-Chain-Token')!
    try {
      // Look up an unconsumed chain token that has not yet expired
      const row = await env.GUESS_DB
        .prepare(
          'SELECT id FROM enrich_job WHERE chain_token = ? AND chain_token_consumed = 0 AND expires_at > unixepoch() LIMIT 1'
        )
        .bind(token)
        .first<{ id: number }>()

      if (row) {
        // Mark consumed — fire-and-forget (non-fatal if it fails)
        env.GUESS_DB
          .prepare('UPDATE enrich_job SET chain_token_consumed = 1 WHERE id = ?')
          .bind(row.id)
          .run()
          .catch(() => {})
        return finalize(await next())
      }
    } catch { /* fall through to normal Basic Auth */ }
  }

  // Parse Authorization header
  const authHeader = request.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Basic ')) {
    return finalize(unauthorizedResponse())
  }

  let providedCredential: string
  try {
    providedCredential = atob(authHeader.slice(6))
  } catch {
    return finalize(unauthorizedResponse())
  }

  const valid = await credentialMatches(providedCredential, storedCredential)

  // Rate limiting: track per-IP failures in D1 kv_cache (15-minute window, 10-attempt cap)
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown'
  const failKey = `auth:fails:${ip}`

  if (!valid) {
    let failCount: number
    try {
      const now = Math.floor(Date.now() / 1000)
      const row = await env.GUESS_DB
        .prepare('SELECT value FROM kv_cache WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)')
        .bind(failKey, now)
        .first<{ value: string }>()
      failCount = row ? parseInt(row.value, 10) || 0 : 0
      const newCount = failCount + 1
      await env.GUESS_DB
        .prepare('INSERT OR REPLACE INTO kv_cache (key, value, cached_at, expires_at) VALUES (?, ?, ?, ?)')
        .bind(failKey, String(newCount), now, now + 900)
        .run()
      if (newCount >= 10) {
        return finalize(
          new Response('Too many failed login attempts. Try again later.', {
            status: 429,
            headers: { 'Content-Type': 'text/plain', 'Retry-After': '900' },
          })
        )
      }
    } catch { /* best-effort — proceed to 401 even if D1 write fails */ }
    return finalize(unauthorizedResponse())
  }

  // Clear failure counter on successful auth (fire-and-forget)
  env.GUESS_DB.prepare('DELETE FROM kv_cache WHERE key = ?').bind(failKey).run().catch(() => {})

  try {
    return finalize(await next())
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    finalize(new Response('Internal Error', { status: 500 }), msg)
    throw err
  }
}
