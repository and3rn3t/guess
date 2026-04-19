/// <reference types="@cloudflare/workers-types" />

export interface Env {
  OPENAI_API_KEY: string
  GUESS_KV: KVNamespace
  GUESS_DB: D1Database
  GUESS_IMAGES: R2Bucket
  CLOUDFLARE_AI_GATEWAY?: string
  AI_GATEWAY_TOKEN?: string
  COOKIE_SECRET?: string
}

const OPENAI_COMPLETIONS = 'https://api.openai.com/v1/chat/completions'

/** Get the chat completions endpoint — AI Gateway if configured, else direct OpenAI */
export function getCompletionsEndpoint(env: Env): string {
  return env.CLOUDFLARE_AI_GATEWAY || OPENAI_COMPLETIONS
}

/** Build auth headers for the LLM endpoint — includes AI Gateway token when routed through gateway */
export function getLlmHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
  }
  if (env.CLOUDFLARE_AI_GATEWAY && env.AI_GATEWAY_TOKEN) {
    headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_TOKEN}`
  }
  return headers
}

/** Sanitize user input string — strip HTML tags and trim */
export function sanitizeString(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

/** Validate that input is a non-empty string within length bounds */
export function validateString(
  value: unknown,
  fieldName: string,
  minLength = 1,
  maxLength = 500
): string {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`Missing or invalid "${fieldName}"`)
  }
  const sanitized = sanitizeString(value)
  if (sanitized.length < minLength) {
    throw new ValidationError(`"${fieldName}" must be at least ${minLength} characters`)
  }
  if (sanitized.length > maxLength) {
    throw new ValidationError(`"${fieldName}" must be at most ${maxLength} characters`)
  }
  return sanitized
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Simple per-user rate limiting via KV. Returns true if allowed, false if rate-limited. */
export async function checkRateLimit(
  kv: KVNamespace,
  userId: string,
  action: string,
  maxPerHour: number
): Promise<{ allowed: boolean; remaining: number }> {
  const hour = Math.floor(Date.now() / 3_600_000)
  const key = `ratelimit:${action}:${userId}:${hour}`

  const current = parseInt((await kv.get(key)) || '0', 10)
  if (current >= maxPerHour) {
    return { allowed: false, remaining: 0 }
  }

  await kv.put(key, String(current + 1), { expirationTtl: 7200 })
  return { allowed: true, remaining: maxPerHour - current - 1 }
}

/** @deprecated Use getOrCreateUserId() for endpoints that need cookie-based auth */
export function getUserId(request: Request): string {
  return (
    request.headers.get('X-User-Id') ||
    request.headers.get('CF-Connecting-IP') ||
    'anonymous'
  )
}

// ── Cookie-based user authentication ─────────────────────────

const COOKIE_NAME = '__gu_id'
const COOKIE_MAX_AGE = 31_536_000 // 365 days
const DEV_SECRET = 'dev-insecure-secret-do-not-use-in-production'

function getSigningKey(env: Env): Promise<CryptoKey> {
  const secret = env.COOKIE_SECRET || DEV_SECRET
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function signValue(value: string, key: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${value}.${hex}`
}

async function verifySignedValue(
  signed: string,
  key: CryptoKey
): Promise<string | null> {
  const dotIdx = signed.lastIndexOf('.')
  if (dotIdx === -1) return null
  const value = signed.slice(0, dotIdx)
  const signature = signed.slice(dotIdx + 1)
  const sigBytes = new Uint8Array(signature.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(value)
  )
  return valid ? value : null
}

function parseCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

function buildSetCookie(signedValue: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(signedValue)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`
}

/** Resolve the authenticated user ID from a signed cookie, or create one.
 *  Returns the userId and an optional Set-Cookie header to include in the response. */
export async function getOrCreateUserId(
  request: Request,
  env: Env
): Promise<{ userId: string; setCookieHeader?: string }> {
  const key = await getSigningKey(env)

  // Try existing cookie
  const cookieVal = parseCookie(request, COOKIE_NAME)
  if (cookieVal) {
    const userId = await verifySignedValue(cookieVal, key)
    if (userId) return { userId }
  }

  // No valid cookie — generate a new user ID
  const userId = crypto.randomUUID()
  const signed = await signValue(userId, key)
  return { userId, setCookieHeader: buildSetCookie(signed) }
}

/** Append a Set-Cookie header to a Response (returns a new Response). */
export function withSetCookie(response: Response, setCookieHeader?: string): Response {
  if (!setCookieHeader) return response
  const res = new Response(response.body, response)
  res.headers.append('Set-Cookie', setCookieHeader)
  return res
}

/** Parse JSON body safely, returning null on failure */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

/** Standard JSON response helper */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Standard error response helper */
export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Read a JSON array from KV, returning empty array if key doesn't exist */
export async function kvGetArray<T>(kv: KVNamespace, key: string): Promise<T[]> {
  const raw = await kv.get(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Read a JSON object from KV, returning null if key doesn't exist */
export async function kvGetObject<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Write a JSON value to KV */
export async function kvPut(kv: KVNamespace, key: string, value: unknown): Promise<void> {
  await kv.put(key, JSON.stringify(value))
}

/** Validate that a value is a valid CharacterCategory */
const VALID_CATEGORIES = new Set([
  'video-games', 'movies', 'anime', 'comics', 'books', 'cartoons', 'tv-shows', 'pop-culture',
])

export function isValidCategory(value: unknown): boolean {
  return typeof value === 'string' && VALID_CATEGORIES.has(value)
}

// ── D1 helpers ────────────────────────────────────────────────

/** Run a D1 read query and return typed rows */
export async function d1Query<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>()
  return result.results
}

/** Run a D1 write statement, return metadata */
export async function d1Run(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run()
}

/** Run a D1 query expecting a single row */
export async function d1First<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>()
}

/** Execute multiple D1 statements in a batch (transactional) */
export async function d1Batch(
  db: D1Database,
  statements: { sql: string; params?: unknown[] }[]
): Promise<D1Result[]> {
  const prepared = statements.map((s) =>
    s.params ? db.prepare(s.sql).bind(...s.params) : db.prepare(s.sql)
  )
  return db.batch(prepared)
}
