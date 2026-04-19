import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  kvGetObject,
} from '../../_helpers'
import {
  type GameSession,
  filterPossibleCharacters,
  generateReasoning,
  SESSION_TTL,
} from '../_game-engine'

// ── Types ────────────────────────────────────────────────────

interface ResumeRequest {
  sessionId: string
}

// ── POST /api/v2/game/resume ─────────────────────────────────
// Resumes an existing server session from KV, returning current state

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<ResumeRequest>(context.request)
  if (!body?.sessionId || typeof body.sessionId !== 'string') {
    return errorResponse('Missing sessionId', 400)
  }

  const session = await kvGetObject<GameSession>(kv, `game:${body.sessionId}`)
  if (!session) {
    return jsonResponse({ expired: true }, 200)
  }

  // Refresh TTL
  await kv.put(`game:${session.id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL })

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
