/// <reference types="@cloudflare/workers-types" />

export interface Env {
  OPENAI_API_KEY: string
  /** Admin panel credential — stored as a Cloudflare secret.
   *  Format: `sha256:<hex-digest-of-"user:pass">` (preferred) or plain `"user:pass"`. */
  ADMIN_CREDENTIAL?: string
  GUESS_DB: D1Database
  GUESS_IMAGES: R2Bucket
  CLOUDFLARE_AI_GATEWAY?: string
  AI_GATEWAY_TOKEN?: string
  COOKIE_SECRET?: string
  /** Durable Object for atomic per-user rate limiting (BI.5) */
  RATE_LIMITER?: DurableObjectNamespace
  /** Workers Analytics Engine dataset for LLM cost telemetry (I.2). */
  LLM_COSTS?: AnalyticsEngineDataset
  /** Workers Analytics Engine dataset for per-request observability (I.4 inline fallback). */
  WORKER_TAIL?: AnalyticsEngineDataset
  /** Workers AI binding (B.4 question embeddings). Optional — endpoints degrade gracefully when absent. */
  AI?: Ai
}

const OPENAI_COMPLETIONS = 'https://api.openai.com/v1/chat/completions'

/** Get the chat completions endpoint — AI Gateway if configured, else direct OpenAI */
export function getCompletionsEndpoint(env: Env): string {
  return env.CLOUDFLARE_AI_GATEWAY || OPENAI_COMPLETIONS
}

/** Build auth headers for the LLM endpoint — includes AI Gateway token when routed through gateway.
 *
 *  Optional `cacheTtlSeconds` opts the request into AI Gateway upstream caching
 *  (AI.1) by emitting `cf-aig-cache-ttl: <seconds>`. The gateway cache key is
 *  derived from the full request body, so identical `(model, messages, params)`
 *  tuples short-circuit the upstream model call. Pass only on deterministic /
 *  read-only routes; never on streaming routes. The header is a no-op when
 *  `CLOUDFLARE_AI_GATEWAY` is unset (e.g. when falling back to direct OpenAI),
 *  but we still emit it so swapping the env var on later environments doesn't
 *  require a code change. */
export function getLlmHeaders(env: Env, cacheTtlSeconds?: number): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
  }
  if (env.CLOUDFLARE_AI_GATEWAY && env.AI_GATEWAY_TOKEN) {
    headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_TOKEN}`
  }
  if (typeof cacheTtlSeconds === 'number' && cacheTtlSeconds > 0) {
    headers['cf-aig-cache-ttl'] = String(Math.floor(cacheTtlSeconds))
  }
  return headers
}

/** Sanitize user input string — strip HTML tags and trim.
 *
 * Applies the tag-stripping regex repeatedly until the string is stable so that
 * malformed/nested tags such as `<scr<script>ipt>` cannot survive a single pass.
 * (CodeQL: js/incomplete-multi-character-sanitization)
 */
export function sanitizeString(input: string): string {
  let prev = input
   
  while (true) {
    const next = prev.replaceAll(/<[^>]*>/g, '')
    if (next === prev) break
    prev = next
  }
  return prev.trim()
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

/**
 * Atomic per-user rate limiting via Durable Objects (BI.5).
 * Fails open (allows the request) when RATE_LIMITER binding is unavailable
 * (e.g. local dev / preview without the DO configured).
 */
export async function checkRateLimitDO(
  env: Env,
  userId: string,
  action: string,
  maxPerHour: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (!env.RATE_LIMITER) {
    // No DO binding — fail open in dev/preview environments
    return { allowed: true, remaining: maxPerHour }
  }
  const id = env.RATE_LIMITER.idFromName(`${action}:${userId}`)
  const stub = env.RATE_LIMITER.get(id)
  const res = await stub.fetch(
    new Request(`https://rate-limiter.internal/?max=${maxPerHour}`, { method: 'POST' })
  )
  return res.json<{ allowed: boolean; remaining: number }>()
}

/** Best-effort rate limiting: fails open when RATE_LIMITER binding is absent. */
export async function checkRateLimitBestEffort(
  env: Env,
  subjectId: string,
  action: string,
  maxPerHour: number,
): Promise<{ allowed: boolean; remaining: number }> {
  if (!env.RATE_LIMITER) {
    return { allowed: true, remaining: maxPerHour }
  }
  return checkRateLimitDO(env, subjectId, action, maxPerHour)
}

/** Resolve request correlation id from header or generate one. */
export function getRequestId(request: Request): string {
  const incoming = request.headers.get('X-Request-Id') ?? request.headers.get('x-request-id')
  if (incoming && incoming.trim().length > 0) {
    return incoming.trim().slice(0, 120)
  }
  return crypto.randomUUID()
}

/** Resolve a stable actor identifier from request headers for rate-limit bucketing. */
export function getActorId(request: Request): string {
  const userId = request.headers.get('X-User-Id') ?? request.headers.get('x-user-id')
  if (userId && userId.trim().length > 0) return `user:${userId.trim().slice(0, 80)}`

  const ip = request.headers.get('CF-Connecting-IP')
  if (ip && ip.trim().length > 0) return `ip:${ip.trim().slice(0, 80)}`

  const ray = request.headers.get('CF-Ray')
  if (ray && ray.trim().length > 0) return `ray:${ray.trim().slice(0, 80)}`

  return 'anonymous'
}

// ── Cookie-based user authentication ─────────────────────────

const COOKIE_NAME = '__gu_id'
const COOKIE_MAX_AGE = 31_536_000 // 365 days

function getSigningKey(env: Env): Promise<CryptoKey> {
  if (!env.COOKIE_SECRET) {
    throw new Error('COOKIE_SECRET is not configured — set this secret in the Cloudflare dashboard')
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.COOKIE_SECRET),
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

/** Attach a correlation id header to a Response. */
export function withRequestId(response: Response, requestId: string): Response {
  const res = new Response(response.body, response)
  res.headers.set('X-Request-Id', requestId)
  return res
}

/** Parse JSON body safely, returning null on failure. Rejects bodies over 64 KB. */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T | null> {
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10)
  if (contentLength > 65_536) return null
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

/**
 * Parse and schema-validate the JSON request body.
 * Returns the parsed + validated data on success, or a 400 Response on failure.
 * Usage: const result = await parseJsonBodyWithSchema(request, MySchema)
 *        if (!result.success) return result.response
 */
export async function parseJsonBodyWithSchema<T>(
  request: Request,
  schema: import('zod').ZodType<T>,
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  const raw = await parseJsonBody<unknown>(request)
  if (raw === null) {
    return { success: false, response: errorResponse('Invalid or missing JSON body', 400) }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      success: false,
      response: jsonResponse({ error: 'Invalid request', details: result.error.flatten() }, 400),
    }
  }
  return { success: true, data: result.data }
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

/** Standardized internal 500 response payload with requestId for support correlation. */
export function internalErrorResponse(requestId: string): Response {
  return jsonResponse({ error: 'Internal server error', requestId }, 500)
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

/**
 * Write an error or warning to the error_logs D1 table (fire-and-forget).
 * Never throws. Evicts oldest entries beyond 1000 rows automatically.
 * Pass to context.waitUntil() where available for reliable delivery.
 */
export function logError(
  db: D1Database | undefined | null,
  source: string,
  level: 'error' | 'warn',
  message: string,
  err?: unknown,
  context?: {
    requestId?: string
    actorId?: string
    path?: string
    method?: string
    status?: number
    extra?: Record<string, unknown>
  },
): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return Promise.resolve()
  const detailPayload: Record<string, unknown> = {}
  if (err != null) {
    if (err instanceof Error) {
      detailPayload.error = {
        message: err.message,
        stack: err.stack?.slice(0, 1500),
      }
    } else {
      detailPayload.error = String(err).slice(0, 500)
    }
  }
  if (context?.requestId) detailPayload.requestId = context.requestId
  if (context?.actorId) detailPayload.actorId = context.actorId
  if (context?.path) detailPayload.path = context.path
  if (context?.method) detailPayload.method = context.method
  if (typeof context?.status === 'number') detailPayload.status = context.status
  if (context?.extra) detailPayload.extra = context.extra

  const detail = Object.keys(detailPayload).length > 0
    ? JSON.stringify(detailPayload)
    : null
  return db
    .batch([
      db.prepare('INSERT INTO error_logs (level, source, message, detail) VALUES (?, ?, ?, ?)')
        .bind(level, source, message.slice(0, 500), detail),
      db.prepare('DELETE FROM error_logs WHERE id NOT IN (SELECT id FROM error_logs ORDER BY id DESC LIMIT 1000)'),
    ])
    .then(() => {})
    .catch(() => {})
}
