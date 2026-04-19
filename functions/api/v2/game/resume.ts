import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  d1First,
  d1Query,
} from '../../_helpers'
import {
  type GameSession,
  type ServerCharacter,
  type ServerQuestion,
  type Answer,
  filterPossibleCharacters,
  generateReasoning,
  selectBestQuestion,
  loadSession,
  storeSession,
  saveSessionState,
  DIFFICULTY_MAP,
} from '../_game-engine'

import type {
  CharactersRow,
  CharacterAttributesRow,
  QuestionsRow,
  GameSessionsRow,
} from '../../_db-types'

// ── Types ────────────────────────────────────────────────────

interface ResumeRequest {
  sessionId: string
}

type D1SessionRow = Omit<GameSessionsRow, 'user_id' | 'completed_at'>

type CharacterRow = Pick<CharactersRow, 'id' | 'name' | 'category' | 'image_url'>

type AttributeRow = Pick<CharacterAttributesRow, 'character_id' | 'attribute_key' | 'value'>

type QuestionRow = Pick<QuestionsRow, 'id' | 'text' | 'attribute_key'>

// ── D1 fallback: reconstruct session from backup ─────────────

async function reconstructFromD1(
  db: D1Database,
  kv: KVNamespace,
  sessionId: string
): Promise<GameSession | null> {
  const row = await d1First<D1SessionRow>(
    db,
    'SELECT id, character_ids, answers, current_question_attr, difficulty, max_questions, created_at FROM game_sessions WHERE id = ? AND completed_at IS NULL',
    [sessionId]
  )
  if (!row) return null

  const charIds: string[] = JSON.parse(row.character_ids)
  const safeIds = charIds.filter((id) => /^[a-z0-9_-]+$/i.test(id))
  if (safeIds.length === 0) return null

  const charIdSet = safeIds.map((id) => `'${id}'`).join(',')

  // Re-fetch character data + attributes from D1
  const [characters, attributes, questionRows] = await Promise.all([
    d1Query<CharacterRow>(
      db,
      `SELECT id, name, category, image_url FROM characters WHERE id IN (${charIdSet})`
    ),
    d1Query<AttributeRow>(
      db,
      `SELECT character_id, attribute_key, value FROM character_attributes WHERE character_id IN (${charIdSet}) AND value IS NOT NULL`
    ),
    d1Query<QuestionRow>(
      db,
      'SELECT id, text, attribute_key FROM questions ORDER BY priority DESC'
    ),
  ])

  // Build attribute maps
  const attrMap = new Map<string, Record<string, boolean | null>>()
  for (const a of attributes) {
    let map = attrMap.get(a.character_id)
    if (!map) {
      map = {}
      attrMap.set(a.character_id, map)
    }
    map[a.attribute_key] = a.value === 1 ? true : a.value === 0 ? false : null
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

  const answers: Answer[] = JSON.parse(row.answers)

  // Re-select current question based on answers
  const filtered = filterPossibleCharacters(serverChars, answers)
  const currentQuestion = row.current_question_attr
    ? serverQuestions.find((q) => q.attribute === row.current_question_attr) ??
      selectBestQuestion(filtered, answers, serverQuestions)
    : selectBestQuestion(filtered, answers, serverQuestions)

  const session: GameSession = {
    id: row.id,
    characters: serverChars,
    questions: serverQuestions,
    answers,
    currentQuestion,
    difficulty: row.difficulty,
    maxQuestions: row.max_questions,
    createdAt: row.created_at,
  }

  // Re-hydrate KV so subsequent requests are fast
  await storeSession(kv, session)

  return session
}

// ── POST /api/v2/game/resume ─────────────────────────────────
// Resumes an existing server session from KV, falling back to D1 backup

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<ResumeRequest>(context.request)
  if (!body?.sessionId || typeof body.sessionId !== 'string') {
    return errorResponse('Missing sessionId', 400)
  }

  let session = await loadSession(kv, body.sessionId)

  // KV miss — try D1 backup
  if (!session) {
    const db = context.env.GUESS_DB
    if (db) {
      try {
        session = await reconstructFromD1(db, kv, body.sessionId)
      } catch {
        // D1 reconstruction failed — treat as expired
      }
    }
  }

  if (!session) {
    return jsonResponse({ expired: true }, 200)
  }

  // Refresh TTL (only writes the lean session, not the pool)
  await saveSessionState(kv, session)

  const filtered = filterPossibleCharacters(session.characters, session.answers)

  // Rebuild current state for the client
  const reasoning = session.currentQuestion
    ? generateReasoning(session.currentQuestion, filtered, session.answers)
    : null

  return jsonResponse({
    expired: false,
    question: session.currentQuestion,
    reasoning,
    remaining: filtered.length,
    totalCharacters: session.characters.length,
    questionCount: session.answers.length,
    answers: session.answers.map((a) => ({
      questionId: a.questionId,
      value: a.value,
    })),
  })
}
