import {
  type Env,
  getOrCreateUserId,
  withSetCookie,
  checkRateLimit,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetArray,
  kvPut,
  d1Run,
  logError,
} from './_helpers'

interface CorrectionVote {
  attribute: string
  currentValue: boolean | null
  suggestedValue: boolean
  userId: string
  createdAt: number
}

interface StoredCharacter {
  id: string
  name: string
  category: string
  attributes: Record<string, boolean | null>
  createdBy: string
  createdAt: number
}

const AUTO_APPLY_THRESHOLD = 3

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const url = new URL(context.request.url)
  const characterId = url.searchParams.get('characterId')
  if (!characterId) return errorResponse('Missing characterId parameter', 400)

  try {
    const corrections = await kvGetArray<CorrectionVote>(kv, `corrections:${characterId}`)
    return jsonResponse(corrections)
  } catch (e) {
    console.error('corrections GET error:', e)
    context.waitUntil(logError(context.env.GUESS_DB, 'corrections', 'error', 'corrections GET error', e))
    return errorResponse('Internal server error', 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{
    characterId?: string
    attribute?: string
    currentValue?: boolean | null
    suggestedValue?: boolean
  }>(context.request)

  if (!body) return errorResponse('Invalid JSON body', 400)

  const { characterId, attribute, suggestedValue } = body
  if (!characterId || typeof characterId !== 'string') return errorResponse('Missing characterId', 400)
  if (!attribute || typeof attribute !== 'string') return errorResponse('Missing attribute', 400)
  if (typeof suggestedValue !== 'boolean') return errorResponse('suggestedValue must be boolean', 400)

  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  const { allowed } = await checkRateLimit(kv, userId, 'corrections', 20)
  if (!allowed) return errorResponse('Rate limit exceeded', 429)

  // Prevent duplicate votes from same user on same attribute
  const key = `corrections:${characterId}`
  const corrections = await kvGetArray<CorrectionVote>(kv, key)
  const alreadyVoted = corrections.some(
    (c) => c.attribute === attribute && c.userId === userId
  )
  if (alreadyVoted) {
    return errorResponse('You already submitted a correction for this attribute', 409)
  }

  const vote: CorrectionVote = {
    attribute,
    currentValue: body.currentValue ?? null,
    suggestedValue,
    userId,
    createdAt: Date.now(),
  }

  try {
    corrections.push(vote)
    await kvPut(kv, key, corrections)

    // Check auto-apply threshold
    const votesForThisAttr = corrections.filter(
      (c) => c.attribute === attribute && c.suggestedValue === suggestedValue
    )
    const uniqueVoters = new Set(votesForThisAttr.map((c) => c.userId))

    if (uniqueVoters.size >= AUTO_APPLY_THRESHOLD) {
      // Auto-apply the correction to the character in KV
      const characters = await kvGetArray<StoredCharacter>(kv, 'global:characters')
      const char = characters.find((c) => c.id === characterId)
      if (char) {
        char.attributes[attribute] = suggestedValue
        await kvPut(kv, 'global:characters', characters)
      }

      // Also write to D1 so the v2 game engine picks it up
      const db = context.env.GUESS_DB
      if (db) {
        try {
          const d1Value = suggestedValue ? 1 : 0
          await d1Run(
            db,
            `INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence)
             VALUES (?, ?, ?, 0.8)`,
            [characterId, attribute, d1Value]
          )
        } catch (e) {
          console.warn('D1 correction write failed (KV still updated):', e)
          context.waitUntil(logError(context.env.GUESS_DB, 'corrections', 'warn', 'D1 correction write failed', e))
        }
      }

      // Clear corrections for this attribute
      const remaining = corrections.filter((c) => c.attribute !== attribute)
      await kvPut(kv, key, remaining)

      return withSetCookie(jsonResponse({ success: true, autoApplied: true }), setCookieHeader)
    }

    return withSetCookie(jsonResponse({ success: true, autoApplied: false }), setCookieHeader)
  } catch (e) {
    console.error('corrections POST error:', e)
    context.waitUntil(logError(context.env.GUESS_DB, 'corrections', 'error', 'corrections POST error', e))
    return errorResponse('Internal server error', 500)
  }
}
