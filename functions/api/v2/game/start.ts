import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  isValidCategory,
  d1Query,
} from '../../_helpers'
import {
  type GameSession,
  type ServerCharacter,
  type ServerQuestion,
  selectBestQuestion,
  generateReasoning,
  POOL_SIZE,
  MIN_ATTRIBUTES,
  SESSION_TTL,
  DIFFICULTY_MAP,
} from '../_game-engine'

// ── Types ────────────────────────────────────────────────────

interface StartRequest {
  categories?: string[]
  difficulty?: string
}

interface CharacterRow {
  id: string
  name: string
  category: string
  image_url: string | null
}

interface AttributeRow {
  character_id: string
  attribute_key: string
  value: number | null
}

interface QuestionRow {
  id: string
  text: string
  attribute_key: string
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

  if (characters.length < 2) {
    return errorResponse('Not enough characters with attribute data for selected categories', 400)
  }

  // Query 2: Get attributes for pool characters
  // D1 limits bound parameters to 100 per query, so batch in chunks
  const charIds = characters.map((c) => c.id)
  const CHUNK_SIZE = 80 // leave headroom below D1's 100-param limit
  const attributes: AttributeRow[] = []
  for (let i = 0; i < charIds.length; i += CHUNK_SIZE) {
    const chunk = charIds.slice(i, i + CHUNK_SIZE)
    const placeholders = chunk.map(() => '?').join(',')
    const rows = await d1Query<AttributeRow>(
      db,
      `SELECT ca.character_id, ca.attribute_key, ca.value
       FROM character_attributes ca
       WHERE ca.character_id IN (${placeholders})
       AND ca.value IS NOT NULL`,
      chunk
    )
    attributes.push(...rows)
  }

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

  // Select first question
  const firstQuestion = selectBestQuestion(serverChars, [], serverQuestions)
  if (!firstQuestion) {
    return errorResponse('No questions available', 500)
  }

  const reasoning = generateReasoning(firstQuestion, serverChars, [])

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
  }

  await kv.put(`game:${sessionId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL })

  return jsonResponse({
    sessionId,
    question: firstQuestion,
    reasoning,
    totalCharacters: serverChars.length,
  })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Game start failed: ${message}`, 500)
  }
}
