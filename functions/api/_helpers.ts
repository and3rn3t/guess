/// <reference types="@cloudflare/workers-types" />

export interface Env {
  OPENAI_API_KEY: string
  GUESS_KV: KVNamespace
  CLOUDFLARE_AI_GATEWAY?: string
  AI_GATEWAY_TOKEN?: string
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

/** Extract user ID from request headers, falling back to CF-Connecting-IP */
export function getUserId(request: Request): string {
  return (
    request.headers.get('X-User-Id') ||
    request.headers.get('CF-Connecting-IP') ||
    'anonymous'
  )
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
