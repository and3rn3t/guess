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
  loadCachedQuestions,
  storeCachedQuestions,
  POOL_SIZE,
  MIN_ATTRIBUTES,
  DIFFICULTY_MAP,
} from '../_game-engine'
import { rephraseQuestionWithCache } from '../_llm-rephrase'

import type { CharactersRow, QuestionsRow } from '../../_db-types'

// ── Types ────────────────────────────────────────────────────

interface StartRequest {
  categories?: string[]
  difficulty?: string
  /** Optional: pin the answer character (used for daily challenge). */
  characterId?: string
}

type CharacterRow = Pick<CharactersRow, 'id' | 'name' | 'category' | 'image_url' | 'popularity'> & { attributes_json: string }

type QuestionRow = Pick<QuestionsRow, 'id' | 'text' | 'attribute_key'>

/** Parse the denormalized attributes_json column into a typed attribute map. */
function parseAttrsJson(json: string): Record<string, boolean | null> {
  try {
    const raw = JSON.parse(json) as Record<string, number>
    const result: Record<string, boolean | null> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (val === 1) { result[key] = true }
      else if (val === 0) { result[key] = false }
      else { result[key] = null }
    }
    return result
  } catch {
    return {}
  }
}

export const DIFFICULTY_TO_PERSONA: Record<string, string> = {
  easy: 'poirot',
  medium: 'watson',
  hard: 'sherlock',
}

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
  const persona = DIFFICULTY_TO_PERSONA[difficulty] ?? 'watson'

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
  // Uses denormalized attribute_count column (maintained by triggers in migration 0017)
  conditions.push('c.attribute_count >= ?')
  params.push(MIN_ATTRIBUTES)

  const where = `WHERE ${conditions.join(' AND ')}`

  // Check questions KV cache first — questions are immutable at runtime, so a 24h
  // cache eliminates the D1 round-trip on every game start after the first.
  const cachedQuestions = await loadCachedQuestions(kv)
  const questionRowsPromise = cachedQuestions
    ? null
    : d1Query<QuestionRow>(db, 'SELECT id, text, attribute_key FROM questions ORDER BY priority DESC')

  // Query 1: Get character pool with denormalized attributes (no separate attribute query)
  //   Fetch 2× POOL_SIZE to get popular chars, then randomly pick POOL_SIZE
  //   This ensures variety across games while keeping the pool reasonably well-known
  const candidateLimit = POOL_SIZE * 2
  const candidates = await d1Query<CharacterRow>(
    db,
    `SELECT c.id, c.name, c.category, c.image_url, c.popularity, c.attributes_json
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
      'SELECT id, name, category, image_url, attributes_json FROM characters WHERE id = ?',
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

  // Build character objects from denormalized attributes_json (no separate D1 attribute query)
  const charIds = characters.map((c) => c.id)
  const serverChars: ServerCharacter[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    imageUrl: c.image_url,
    attributes: parseAttrsJson(c.attributes_json),
  }))

  // Resolve questions from KV cache or D1 result
  let serverQuestions: ServerQuestion[]
  if (cachedQuestions) {
    serverQuestions = cachedQuestions
  } else {
    const questionRows = await questionRowsPromise
    serverQuestions = (questionRows ?? []).map((q) => ({
      id: q.id,
      text: q.text,
      attribute: q.attribute_key,
    }))
    // Cache for future games (non-blocking)
    if (serverQuestions.length > 0) {
      context.waitUntil(storeCachedQuestions(kv, serverQuestions))
    }
  }

  // Build coverage map: ratio of pool characters with each attribute filled.
  // Passed to selectBestQuestion so null-scoring is coverage-weighted from question 1.
  const coverageMap = new Map<string, number>()
  const charCount = serverChars.length
  for (const q of serverQuestions) {
    const known = serverChars.filter((c) => c.attributes[q.attribute] != null).length
    coverageMap.set(q.attribute, known / charCount)
  }

  // Build popularity prior: normalize raw DB scores to [0,1] within pool.
  // Max-normalised so the most popular character in the pool scores 1.0.
  const maxPop = Math.max(...characters.map((c) => c.popularity ?? 0), 1)
  const popularityMap = new Map(
    characters.map((c) => [c.id, (c.popularity ?? 0) / maxPop])
  )

  // Select first question
  const firstQuestion = selectBestQuestion(serverChars, [], serverQuestions, { scoring: { coverageMap, popularityMap } })
  if (!firstQuestion) {
    return errorResponse('No questions available', 500)
  }

  const reasoning = generateReasoning(firstQuestion, serverChars, [])

  // Create session
  const sessionId = crypto.randomUUID()
  const session: GameSession = {
    id: sessionId,
    characters: serverChars,
    questions: serverQuestions,
    coverageMap,
    popularityMap,
    answers: [],
    currentQuestion: firstQuestion,
    difficulty,
    maxQuestions,
    createdAt: Date.now(),
    rejectedGuesses: [],
    skippedQuestions: [],
    guessCount: 0,
    postRejectCooldown: 0,
    persona,
  }

  // Parallelize all three independent async ops before responding:
  //   1. Rephrase first question via LLM (with KV cache for frequently-seen first questions)
  //   2. Store session in KV (required before any answer can be processed)
  //   3. Get/create user ID for D1 backup
  const [rephrased, , { userId, setCookieHeader }] = await Promise.all([
    rephraseQuestionWithCache(context.env, kv, firstQuestion, [], reasoning, 1, maxQuestions, undefined, persona),
    storeSession(kv, session),
    getOrCreateUserId(context.request, context.env),
  ])
  if (rephrased) firstQuestion.displayText = rephrased

  // D1 backup — fire-and-forget (game still works via KV if this fails)
  context.waitUntil(
    d1Run(
      db,
      `INSERT INTO game_sessions (id, user_id, character_ids, answers, current_question_attr, difficulty, max_questions, dropped_at_phase, created_at)
       VALUES (?, ?, ?, '[]', ?, ?, ?, 'playing', ?)`,
      [sessionId, userId, JSON.stringify(charIds), firstQuestion.attribute, difficulty, maxQuestions, session.createdAt]
    ).catch(() => {})
  )

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
