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
  loadCachedQuestions,
  storeCachedQuestions,
  parseAttrsJson,
} from '../_game-engine'
import { rephraseQuestionWithCache } from '../_llm-rephrase'
import type {
  CharactersRow,
  QuestionsRow,
  GameSessionsRow,
} from '../../_db-types'

// ── Types ────────────────────────────────────────────────────

interface ResumeRequest {
  sessionId: string
}

type D1SessionRow = Omit<GameSessionsRow, 'user_id' | 'completed_at'>

type CharacterRow = Pick<CharactersRow, 'id' | 'name' | 'category' | 'image_url'> & { attributes_json: string }

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

  const placeholders = safeIds.map(() => '?').join(',')

  // Check questions cache first (avoids a D1 round-trip for the questions query)
  const cachedQuestions = await loadCachedQuestions(kv)

  // Re-fetch characters (with denormalized attributes_json) and optionally questions from D1
  const [characters, questionRows] = await Promise.all([
    d1Query<CharacterRow>(
      db,
      `SELECT id, name, category, image_url, attributes_json FROM characters WHERE id IN (${placeholders})`,
      safeIds
    ),
    cachedQuestions
      ? Promise.resolve<QuestionRow[]>([])
      : d1Query<QuestionRow>(db, 'SELECT id, text, attribute_key FROM questions ORDER BY priority DESC'),
  ])

  const serverChars: ServerCharacter[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    imageUrl: c.image_url,
    attributes: parseAttrsJson(c.attributes_json),
  }))

  const serverQuestions: ServerQuestion[] = cachedQuestions ?? questionRows.map((q) => ({
    id: q.id,
    text: q.text,
    attribute: q.attribute_key,
  }))
  if (!cachedQuestions && serverQuestions.length > 0) {
    storeCachedQuestions(kv, serverQuestions).catch(() => {})
  }

  const answers: Answer[] = JSON.parse(row.answers)

  // Re-select current question based on answers
  const filtered = filterPossibleCharacters(serverChars, answers)
  const resumeOptions = { gameDifficulty: row.difficulty as 'easy' | 'medium' | 'hard' }
  const currentQuestion = row.current_question_attr
    ? serverQuestions.find((q) => q.attribute === row.current_question_attr) ??
      selectBestQuestion(filtered, answers, serverQuestions, resumeOptions)
    : selectBestQuestion(filtered, answers, serverQuestions, resumeOptions)

  const session: GameSession = {
    id: row.id,
    characters: serverChars,
    questions: serverQuestions,
    answers,
    currentQuestion,
    difficulty: row.difficulty,
    maxQuestions: row.max_questions,
    createdAt: row.created_at,
    rejectedGuesses: [],
    skippedQuestions: [],
    guessCount: 0,
    postRejectCooldown: 0,
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

  const filtered = filterPossibleCharacters(session.characters, session.answers, session.rejectedGuesses)

  // Rebuild current state for the client
  const reasoning = session.currentQuestion
    ? generateReasoning(session.currentQuestion, filtered, session.answers)
    : null

  // Parallelize: refresh session TTL + rephrase question (with cache for first questions)
  let rephrased: string | null = null
  if (session.currentQuestion && reasoning) {
    ;[rephrased] = await Promise.all([
      rephraseQuestionWithCache(
        context.env,
        kv,
        session.currentQuestion,
        session.answers,
        reasoning,
        session.answers.length + 1,
        session.maxQuestions,
        undefined,
        session.persona,
      ),
      saveSessionState(kv, session),
    ])
  } else {
    await saveSessionState(kv, session)
  }
  if (rephrased && session.currentQuestion) {
    session.currentQuestion.displayText = rephrased
  }

  return jsonResponse({
    expired: false,
    question: session.currentQuestion,
    reasoning,
    remaining: filtered.length,
    totalCharacters: session.characters.length,
    questionCount: session.answers.length,
    guessCount: session.guessCount,
    answers: session.answers.map((a) => ({
      questionId: a.questionId,
      value: a.value,
    })),
  })
}
