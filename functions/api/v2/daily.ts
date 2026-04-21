import {
  type Env,
  jsonResponse,
  errorResponse,
  d1First,
  getOrCreateUserId,
  withSetCookie,
} from '../_helpers'
import { MIN_ATTRIBUTES } from './_game-engine'

// ── Simple deterministic hash: date string → non-negative integer ─────────────
function dateHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    h = h >>> 0 // keep unsigned 32-bit
  }
  return h
}

/** UTC date string for today, e.g. "2026-04-20" */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Seconds remaining until next UTC midnight */
function secondsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}

// ── GET /api/v2/daily ──────────────────────────────────────────
// Returns today's challenge character id/name and whether the user
// has already completed today's challenge.

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db || !kv) return errorResponse('D1/KV not configured', 503)

  const today = todayUtc()

  // ── KV cache: reuse today's character without hitting D1 ────────────
  const cacheKey = `daily:character:${today}`
  let dailyCharacter: { id: string; name: string; imageUrl: string | null } | null = null

  const cached = await kv.get(cacheKey, 'json') as typeof dailyCharacter | null
  if (cached) {
    dailyCharacter = cached
  } else {
    // Count well-covered characters
    const totalRow = await d1First<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM characters c
       WHERE c.id IN (
         SELECT character_id FROM character_attributes
         WHERE value IS NOT NULL
         GROUP BY character_id
         HAVING COUNT(*) >= ?
       )`,
      [MIN_ATTRIBUTES]
    )
    const total = totalRow?.count ?? 0
    if (total === 0) return errorResponse('No characters available', 503)

    // Pick a deterministic row offset from today's date
    const offset = dateHash(today) % total

    const row = await d1First<{ id: string; name: string; image_url: string | null }>(
      db,
      `SELECT c.id, c.name, c.image_url
       FROM characters c
       WHERE c.id IN (
         SELECT character_id FROM character_attributes
         WHERE value IS NOT NULL
         GROUP BY character_id
         HAVING COUNT(*) >= ?
       )
       ORDER BY c.id
       LIMIT 1 OFFSET ?`,
      [MIN_ATTRIBUTES, offset]
    )
    if (!row) return errorResponse('Could not select daily character', 503)

    dailyCharacter = { id: row.id, name: row.name, imageUrl: row.image_url ?? null }

    // Cache until end of UTC day (seconds remaining today)
    await kv.put(cacheKey, JSON.stringify(dailyCharacter), { expirationTtl: secondsUntilMidnight() })
  }

  // ── Check if this user already completed today's challenge ────────────
  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  const completionKey = `daily:done:${today}:${userId}`
  const completionRaw = await kv.get(completionKey, 'json') as {
    won: boolean
    questionsAsked: number
  } | null

  const body = JSON.stringify({
    date: today,
    characterId: dailyCharacter.id,
    // Only reveal the name after the user has completed today's challenge
    characterName: completionRaw ? dailyCharacter.name : null,
    imageUrl: completionRaw ? dailyCharacter.imageUrl : null,
    completed: completionRaw !== null,
    won: completionRaw?.won ?? null,
    questionsAsked: completionRaw?.questionsAsked ?? null,
  })

  return withSetCookie(
    new Response(body, { headers: { 'Content-Type': 'application/json' } }),
    setCookieHeader
  )
}

// ── POST /api/v2/daily ──────────────────────────────────────────
// Records that the user completed today's daily challenge.
// Called by the client after /api/v2/game/result.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  let body: { won?: boolean; questionsAsked?: number } = {}
  try {
    body = (await context.request.json()) as typeof body
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  if (typeof body.won !== 'boolean') {
    return errorResponse('Missing required field: won', 400)
  }

  const today = todayUtc()
  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  const completionKey = `daily:done:${today}:${userId}`

  // Idempotent — only record first completion
  const existing = await kv.get(completionKey)
  if (!existing) {
    const ttl = secondsUntilMidnight() + 86_400 // keep for an extra day
    await kv.put(
      completionKey,
      JSON.stringify({ won: body.won, questionsAsked: body.questionsAsked ?? null }),
      { expirationTtl: ttl }
    )
  }

  return withSetCookie(
    jsonResponse({ success: true, alreadyCompleted: existing !== null }),
    setCookieHeader
  )
}
