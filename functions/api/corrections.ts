import { defineHandler } from './_handler'
import {
  d1Run,
  errorResponse,
  jsonResponse,
  kvGetArray,
  kvPut,
  logError,
  parseJsonBodyWithSchema,
} from './_helpers'
import { SubmitCorrectionRequestSchema } from './_schemas'

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

export const onRequestGet = defineHandler(
  { name: 'corrections', requireUser: false },
  async ({ env, url }) => {
    const characterId = url.searchParams.get('characterId')
    if (!characterId) {
      return errorResponse('Missing characterId parameter', 400)
    }
    const corrections = await kvGetArray<CorrectionVote>(
      env.GUESS_KV,
      `corrections:${characterId}`,
    )
    return jsonResponse(corrections)
  },
)

export const onRequestPost = defineHandler(
  { name: 'corrections', rateLimit: 20 },
  async ({ env, request, userId, waitUntil }) => {
    const parsed = await parseJsonBodyWithSchema(request, SubmitCorrectionRequestSchema)
    if (!parsed.success) return parsed.response
    const { characterId, attribute, suggestedValue, currentValue } = parsed.data

    const kv = env.GUESS_KV
    const key = `corrections:${characterId}`
    const corrections = await kvGetArray<CorrectionVote>(kv, key)

    // Prevent duplicate votes from same user on same attribute
    const alreadyVoted = corrections.some(
      (c) => c.attribute === attribute && c.userId === userId,
    )
    if (alreadyVoted) {
      return errorResponse(
        'You already submitted a correction for this attribute',
        409,
      )
    }

    const vote: CorrectionVote = {
      attribute,
      currentValue: currentValue ?? null,
      suggestedValue,
      userId,
      createdAt: Date.now(),
    }

    corrections.push(vote)
    await kvPut(kv, key, corrections)

    // Check auto-apply threshold
    const votesForThisAttr = corrections.filter(
      (c) => c.attribute === attribute && c.suggestedValue === suggestedValue,
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
      const db = env.GUESS_DB
      if (db) {
        try {
          const d1Value = suggestedValue ? 1 : 0
          await d1Run(
            db,
            `INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence)
             VALUES (?, ?, ?, 0.8)`,
            [characterId, attribute, d1Value],
          )
        } catch (e) {
          console.warn('D1 correction write failed (KV still updated):', e)
          waitUntil(
            logError(
              env.GUESS_DB,
              'corrections',
              'warn',
              'D1 correction write failed',
              e,
            ),
          )
        }
      }

      // Clear corrections for this attribute
      const remaining = corrections.filter((c) => c.attribute !== attribute)
      await kvPut(kv, key, remaining)

      return jsonResponse({ success: true, autoApplied: true })
    }

    return jsonResponse({ success: true, autoApplied: false })
  },
)
