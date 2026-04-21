import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  isValidCategory,
  d1Query,
  d1First,
  d1Run,
  getOrCreateUserId,
  withSetCookie,
} from '../../_helpers'
import {
  type GameSession,
  type ServerCharacter,
  type ServerQuestion,
  selectBestQuestion,
  generateReasoning,
  storeSession,
  POOL_SIZE,
  MIN_ATTRIBUTES,
  DIFFICULTY_MAP,
} from '../_game-engine'
import { rephraseQuestion } from '../_llm-rephrase'

import type { CharactersRow, CharacterAttributesRow, QuestionsRow } from '../../_db-types'

// ── Types ────────────────────────────────────────────────────

interface StartRequest {
  categories?: string[]
  difficulty?: string
  /** Optional: pin the answer character (used for daily challenge). */
  characterId?: string
}

type CharacterRow = Pick<CharactersRow, 'id' | 'name' | 'category' | 'image_url'>

type AttributeRow = Pick<CharacterAttributesRow, 'character_id' | 'attribute_key' | 'value'>

type QuestionRow = Pick<QuestionsRow, 'id' | 'text' | 'attribute_key'>

// ── POST /api/v2/game/start ──────────────────────────────────
// Creates a game session, selects character pool from D1, returns first question

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db || !kv) return errorResponse('D1/KV not configured', 503)

  const body = await parseJsonBody<StartRequest>(context.request)
  const categories = body?.categories?.filter(isValidCategory) ?? []
  const difficulty =
    body?.difficulty && body.difficulty in DIFFICULTY_MAP ? body.difficulty : 'medium'
  const maxQuestions = DIFFICULTY_MAP[difficulty]

  // Validate optional pinned character ID (daily challenge)
  const pinnedCharId =
    typeof body?.characterId === 'string' && /^[a-z0-9_-]+$/.test(body.characterId)
      ? body.characterId
      : null

  // Build category filter
  const conditions: string[] = []
  const params: unknown[] = []
  if (categories.length > 0) {
    conditions.push(`c.category IN (${categories.map(() => '?').join(',')})`)
    params.push(...categories)
  }

  // Only include characters with sufficient attribute coverage
  conditions.push(
    `c.id IN (SELECT character_id FROM character_attributes WHERE value IS NOT NULL GROUP BY character_id HAVING COUNT(*) >= ?)`
  )
  params.push(MIN_ATTRIBUTES)

  const where = `WHERE ${conditions.join(' AND ')}`

  // Query 1: Get character pool — top candidates by popularity, then randomize
  //   Fetch 2× POOL_SIZE to get popular chars, then randomly pick POOL_SIZE
  //   This ensures variety across games while keeping the pool reasonably well-known
  const candidateLimit = POOL_SIZE * 2
  const candidates = await d1Query<CharacterRow>(
    db,
    `SELECT c.id, c.name, c.category, c.image_url
     FROM characters c
     ${where}
     ORDER BY c.popularity DESC
     LIMIT ?`,
    [...params, candidateLimit]
  )

  // Shuffle candidates and take POOL_SIZE
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const characters = candidates.slice(0, POOL_SIZE)

  // Daily challenge: ensure the pinned character is in the pool
  if (pinnedCharId && !characters.some((c) => c.id === pinnedCharId)) {
    const pinned = await d1First<CharacterRow>(
      db,
      'SELECT id, name, category, image_url FROM characters WHERE id = ?',
      [pinnedCharId]
    )
    if (pinned) {
      // Replace the last slot with the pinned character
      characters[characters.length - 1] = pinned
    }
  }

  if (characters.length < 2) {
    return errorResponse('Not enough characters with attribute data for selected categories', 400)
  }

  // Query 2: Get attributes for pool characters
  // IDs are from our own DB query above; validated to safe charset to avoid injection
  const charIds = characters.map((c) => c.id)
  const safeIds = charIds.filter((id) => /^[a-z0-9_-]+$/.test(id))
  const charIdSet = safeIds.map((id) => `'${id}'`).join(',')
  const attributes = await d1Query<AttributeRow>(
    db,
    `SELECT ca.character_id, ca.attribute_key, ca.value
     FROM character_attributes ca
     WHERE ca.character_id IN (${charIdSet})
     AND ca.value IS NOT NULL`
  )

  // Query 3: Get all questions
  const questionRows = await d1Query<QuestionRow>(
    db,
    'SELECT id, text, attribute_key FROM questions ORDER BY priority DESC'
  )

  // Assemble character objects with attribute maps
  const attrMap = new Map<string, Record<string, boolean | null>>()
  for (const a of attributes) {
    let map = attrMap.get(a.character_id)
    if (!map) {
      map = {}
      attrMap.set(a.character_id, map)
    }
    if (a.value === 1) {
      map[a.attribute_key] = true
    } else if (a.value === 0) {
      map[a.attribute_key] = false
    } else {
      map[a.attribute_key] = null
    }
  }

  const serverChars: ServerCharacter[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    imageUrl: c.image_url,
    attributes: attrMap.get(c.id) || {},
  }))

  const serverQuestions: ServerQuestion[] = questionRows.map((q) => ({
    id: q.id,
    text: q.text,
    attribute: q.attribute_key,
  }))

  // Build coverage map: ratio of pool characters with each attribute filled.
  // Passed to selectBestQuestion so null-scoring is coverage-weighted from question 1.
  const coverageMap = new Map<string, number>()
  const charCount = serverChars.length
  for (const q of serverQuestions) {
    const known = serverChars.filter((c) => c.attributes[q.attribute] != null).length
    coverageMap.set(q.attribute, known / charCount)
  }

  // Select first question
  const firstQuestion = selectBestQuestion(serverChars, [], serverQuestions, { scoring: { coverageMap } })
  if (!firstQuestion) {
    return errorResponse('No questions available', 500)
  }

  const reasoning = generateReasoning(firstQuestion, serverChars, [])

  // Rephrase question via LLM for conversational feel (non-blocking fallback)
  const rephrased = await rephraseQuestion(
    context.env,
    firstQuestion,
    [],
    reasoning,
    1,
    maxQuestions,
  )
  if (rephrased) {
    firstQuestion.displayText = rephrased
  }

  // Create session and store in KV
  const sessionId = crypto.randomUUID()
  const session: GameSession = {
    id: sessionId,
    characters: serverChars,
    questions: serverQuestions,
    answers: [],
    currentQuestion: firstQuestion,
    difficulty,
    maxQuestions,
    createdAt: Date.now(),
    rejectedGuesses: [],
    guessCount: 0,
    postRejectCooldown: 0,
  }

  await storeSession(kv, session)

  // D1 backup — survives KV expiration for session recovery
  const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
  try {
    await d1Run(
      db,
      `INSERT INTO game_sessions (id, user_id, character_ids, answers, current_question_attr, difficulty, max_questions, created_at)
       VALUES (?, ?, ?, '[]', ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        JSON.stringify(charIds),
        firstQuestion.attribute,
        difficulty,
        maxQuestions,
        session.createdAt,
      ]
    )
  } catch {
    // Non-critical — game still works via KV
  }

  return withSetCookie(jsonResponse({
    sessionId,
    question: firstQuestion,
    reasoning,
    totalCharacters: serverChars.length,
    maxQuestions,
  }), setCookieHeader)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Game start failed: ${message}`, 500)
  }
}
