import {
  type Env,
  getUserId,
  checkRateLimit,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetArray,
  kvPut,
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

  const corrections = await kvGetArray<CorrectionVote>(kv, `corrections:${characterId}`)
  return jsonResponse(corrections)
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

  const userId = getUserId(context.request)
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

  corrections.push(vote)
  await kvPut(kv, key, corrections)

  // Check auto-apply threshold
  const votesForThisAttr = corrections.filter(
    (c) => c.attribute === attribute && c.suggestedValue === suggestedValue
  )
  const uniqueVoters = new Set(votesForThisAttr.map((c) => c.userId))

  if (uniqueVoters.size >= AUTO_APPLY_THRESHOLD) {
    // Auto-apply the correction to the character
    const characters = await kvGetArray<StoredCharacter>(kv, 'global:characters')
    const char = characters.find((c) => c.id === characterId)
    if (char) {
      char.attributes[attribute] = suggestedValue
      await kvPut(kv, 'global:characters', characters)
    }

    // Clear corrections for this attribute
    const remaining = corrections.filter((c) => c.attribute !== attribute)
    await kvPut(kv, key, remaining)

    return jsonResponse({ success: true, autoApplied: true })
  }

  return jsonResponse({ success: true, autoApplied: false })
}
