import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  checkRateLimit,
  getOrCreateUserId,
  withSetCookie,
  sanitizeString,
  d1First,
  d1Query,
  d1Run,
  d1Batch,
  kvGetArray,
  kvPut,
} from '../../_helpers'

// ── Types ────────────────────────────────────────────────────

interface RevealRequest {
  characterName: string
  answers: Array<{ questionId: string; value: string }>
}

interface CharacterRow {
  id: string
  name: string
}

interface AttributeRow {
  attribute_key: string
  value: number | null
}

interface CorrectionVote {
  attribute: string
  currentValue: boolean | null
  suggestedValue: boolean
  userId: string
  createdAt: number
}

// ── POST /api/v2/game/reveal ─────────────────────────────────
// Called when the AI loses and the user reveals the answer.
// - Looks up the character in the DB (fuzzy name match)
// - Backfills null attributes from confident yes/no answers
// - Queues correction suggestions for contradicting attributes
// - Stores a game_reveals record for audit/batch refinement

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<RevealRequest>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const rawName = body.characterName
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    return errorResponse('characterName is required', 400)
  }
  if (!Array.isArray(body.answers)) {
    return errorResponse('answers must be an array', 400)
  }

  const characterName = sanitizeString(rawName.trim()).slice(0, 200)

  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  const { allowed } = await checkRateLimit(kv, userId, 'reveals', 10)
  if (!allowed) return errorResponse('Rate limit exceeded', 429)

  // Keep only confident yes/no answers
  const confidentAnswers = body.answers.filter(
    (a) => (a.value === 'yes' || a.value === 'no') && typeof a.questionId === 'string'
  )

  // ── Find character by name (case-insensitive exact, then LIKE) ───────────
  let character = await d1First<CharacterRow>(
    db,
    'SELECT id, name FROM characters WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [characterName]
  )

  if (!character) {
    character = await d1First<CharacterRow>(
      db,
      "SELECT id, name FROM characters WHERE LOWER(name) LIKE LOWER(?) LIMIT 1",
      [`%${characterName}%`]
    )
  }

  let attributesFilled = 0
  let discrepancies = 0

  if (character && confidentAnswers.length > 0) {
    // Load existing attributes for this character
    const existing = await d1Query<AttributeRow>(
      db,
      'SELECT attribute_key, value FROM character_attributes WHERE character_id = ?',
      [character.id]
    )
    const attrMap = new Map<string, number | null>(
      existing.map((r) => [r.attribute_key, r.value])
    )

    const backfillStatements: { sql: string; params: unknown[] }[] = []
    const correctionsByAttr = new Map<string, CorrectionVote>()

    for (const answer of confidentAnswers) {
      const suggestedBool = answer.value === 'yes'
      const suggestedInt = suggestedBool ? 1 : 0

      if (!attrMap.has(answer.questionId)) {
        // Attribute unknown in DB — backfill with low confidence
        backfillStatements.push({
          sql: `INSERT INTO character_attributes (character_id, attribute_key, value, confidence)
                VALUES (?, ?, ?, 0.5)
                ON CONFLICT(character_id, attribute_key) DO NOTHING`,
          params: [character.id, answer.questionId, suggestedInt],
        })
        attributesFilled++
      } else {
        const existing = attrMap.get(answer.questionId)
        if (existing === null) {
          // Known attribute but null value — fill it in
          backfillStatements.push({
            sql: `UPDATE character_attributes SET value = ?, confidence = 0.5
                  WHERE character_id = ? AND attribute_key = ? AND value IS NULL`,
            params: [suggestedInt, character.id, answer.questionId],
          })
          attributesFilled++
        } else if (existing !== suggestedInt) {
          // Existing value contradicts the player's answer — queue a correction
          discrepancies++
          correctionsByAttr.set(answer.questionId, {
            attribute: answer.questionId,
            currentValue: existing === 1,
            suggestedValue: suggestedBool,
            userId: `system:reveal:${userId}`,
            createdAt: Date.now(),
          })
        }
      }
    }

    // Apply backfills in a batch
    if (backfillStatements.length > 0) {
      await d1Batch(db, backfillStatements).catch(() => { /* non-critical */ })
    }

    // Queue correction suggestions in KV (one per contradicting attribute)
    for (const [, vote] of correctionsByAttr) {
      const key = `corrections:${character.id}`
      const existing = await kvGetArray<CorrectionVote>(kv, key)
      // Only add if no system reveal vote already exists for this attribute
      const alreadyQueued = existing.some(
        (c) => c.attribute === vote.attribute && c.userId.startsWith('system:reveal:')
      )
      if (!alreadyQueued) {
        await kvPut(kv, key, [...existing, vote])
      }
    }
  }

  // ── Store the reveal record ───────────────────────────────────────────────
  await d1Run(
    db,
    `INSERT INTO game_reveals (actual_character_name, actual_character_id, answers, attributes_filled, discrepancies, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      characterName,
      character?.id ?? null,
      JSON.stringify(body.answers),
      attributesFilled,
      discrepancies,
      Date.now(),
    ]
  ).catch(() => { /* non-critical — table may not exist on preview */ })

  return withSetCookie(
    jsonResponse({
      found: character !== null,
      characterId: character?.id ?? null,
      characterName: character?.name ?? null,
      attributesFilled,
      discrepancies,
    }),
    setCookieHeader
  )
}
