import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  isValidCategory,
  d1Query,
  d1Run,
  getOrCreateUserId,
  getRequestId,
  getActorId,
  internalErrorResponse,
  withSetCookie,
  withRequestId,
  logError,
} from '../../_helpers'
import { StartRequestSchema } from '../../_schemas'
import {
  type GameSession,
  type ServerCharacter,
  type ServerQuestion,
  selectBestQuestion,
  generateReasoning,
  storeSession,
  loadCachedQuestions,
  storeCachedQuestions,
  parseAttrsJson,
  POOL_SIZE,
  MIN_ATTRIBUTES,
  DIFFICULTY_MAP,
} from '../_game-engine'
import { rephraseQuestionWithCache } from '../_llm-rephrase'
import { assignVariant } from '../_ab'
import {
  queryCharacterPoolWithTriviaFallback,
  queryPinnedCharacterWithTriviaFallback,
  type TriviaFallbackLogContext,
} from './_start_trivia_fallback'

import type { QuestionsRow } from '../../_db-types'

// ── Types ────────────────────────────────────────────────────

type QuestionRow = Pick<QuestionsRow, 'id' | 'text' | 'attribute_key'>

export const DIFFICULTY_TO_PERSONA: Record<string, string> = {
  easy: 'poirot',
  medium: 'watson',
  hard: 'sherlock',
}

function isMissingRetiredAtColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes('no such column: retired_at')
}

async function loadQuestionsWithRetirementFallback(db: D1Database): Promise<QuestionRow[]> {
  try {
    return await d1Query<QuestionRow>(
      db,
      'SELECT id, text, attribute_key FROM questions WHERE retired_at IS NULL ORDER BY priority DESC'
    )
  } catch (error) {
    if (!isMissingRetiredAtColumnError(error)) throw error
    return d1Query<QuestionRow>(db, 'SELECT id, text, attribute_key FROM questions ORDER BY priority DESC')
  }
}

function parseTrivia(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const cleaned = parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 3)
    return cleaned.length > 0 ? cleaned : undefined
  } catch {
    return undefined
  }
}

// ── POST /api/v2/game/start ──────────────────────────────────
// Creates a game session, selects character pool from D1, returns first question

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request)
  const actorId = getActorId(context.request)
  const url = new URL(context.request.url)
  const respond = (response: Response): Response => withRequestId(response, requestId)
  const internalError = (): Response =>
    respond(internalErrorResponse(requestId))

  try {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db || !kv) return respond(errorResponse('D1/KV not configured', 503))

  const parsed = await parseJsonBodyWithSchema(context.request, StartRequestSchema)
  if (!parsed.success) return respond(parsed.response)
  const categories = (parsed.data.categories ?? []).filter(isValidCategory)
  const difficulty = parsed.data.difficulty ?? 'medium'
  const maxQuestions = DIFFICULTY_MAP[difficulty]
  const persona = DIFFICULTY_TO_PERSONA[difficulty] ?? 'watson'

  // Validate optional pinned character ID (daily challenge)
  const pinnedCharId = parsed.data.characterId ?? null

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
  const triviaFallbackCtx: TriviaFallbackLogContext = {
    env: context.env,
    requestId,
    actorId,
    path: url.pathname,
    method: context.request.method,
  }

  // Check questions KV cache first — questions are immutable at runtime, so a 24h
  // cache eliminates the D1 round-trip on every game start after the first.
  const cachedQuestions = await loadCachedQuestions(kv)
  const questionRowsPromise = cachedQuestions
    ? null
    : loadQuestionsWithRetirementFallback(db)

  // Query 1: Get character pool with denormalized attributes (no separate attribute query)
  //   Fetch 2× POOL_SIZE to get popular chars, then randomly pick POOL_SIZE
  //   This ensures variety across games while keeping the pool reasonably well-known
  const candidateLimit = POOL_SIZE * 2
  const candidates = await queryCharacterPoolWithTriviaFallback(
    db,
    where,
    params,
    candidateLimit,
    triviaFallbackCtx,
  )

  // Shuffle candidates and take POOL_SIZE
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const characters = candidates.slice(0, POOL_SIZE)

  // Daily challenge: ensure the pinned character is in the pool
  if (pinnedCharId && !characters.some((c) => c.id === pinnedCharId)) {
    const pinned = await queryPinnedCharacterWithTriviaFallback(
      db,
      pinnedCharId,
      triviaFallbackCtx,
    )
    if (pinned) {
      // Replace the last slot with the pinned character
      characters[characters.length - 1] = pinned
    }
  }

  if (characters.length < 2) {
    return respond(errorResponse('Not enough characters with attribute data for selected categories', 400))
  }

  // Build character objects from denormalized attributes_json (no separate D1 attribute query)
  const charIds = characters.map((c) => c.id)
  const serverChars: ServerCharacter[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    imageUrl: c.image_url,
    trivia: parseTrivia(c.trivia),
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
  const firstQuestion = selectBestQuestion(serverChars, [], serverQuestions, {
    scoring: { coverageMap, popularityMap },
    gameDifficulty: difficulty,
  })
  if (!firstQuestion) {
    return respond(errorResponse('No questions available', 500))
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

  // A/B variant assignment — deterministic per (userId, day). Re-stores session
  // with stamped variant + selector + userId. Cheap (one extra KV put on a small lean blob).
  const assignment = await assignVariant(kv, userId)
  session.variant = assignment.variant
  session.selector = assignment.selector
  session.userId = userId
  context.waitUntil(storeSession(kv, session))

  // D1 backup — fire-and-forget (game still works via KV if this fails)
  context.waitUntil(
    d1Run(
      db,
      `INSERT INTO game_sessions (id, user_id, character_ids, answers, current_question_attr, difficulty, max_questions, dropped_at_phase, created_at)
       VALUES (?, ?, ?, '[]', ?, ?, ?, 'playing', ?)`,
      [sessionId, userId, JSON.stringify(charIds), firstQuestion.attribute, difficulty, maxQuestions, session.createdAt]
    ).catch(() => {})
  )

  return respond(withSetCookie(jsonResponse({
    sessionId,
    question: firstQuestion,
    reasoning,
    totalCharacters: serverChars.length,
    maxQuestions,
  }), setCookieHeader))
  } catch (err) {
    console.error('POST /api/v2/game/start error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'start', 'error', 'game start failed', err, {
      requestId,
      actorId,
      path: url.pathname,
      method: context.request.method,
      status: 500,
    }))
    return internalError()
  }
}
