import type {
  CharactersRow,
  GameSessionsRow,
  QuestionsRow,
} from "../../_db-types";
import {
  d1First,
  d1Query,
  type Env,
  errorResponse,
  getActorId,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  logError,
  parseJsonBody,
  withRequestId,
  withSetCookie,
} from "../../_helpers";
import {
  type Answer,
  filterPossibleCharacters,
  type GameSession,
  generateReasoning,
  loadCachedQuestions,
  loadSession,
  parseAttrsJson,
  saveSessionState,
  selectBestQuestion,
  type ServerCharacter,
  type ServerQuestion,
  storeCachedQuestions,
  storeSession,
  verifySessionOwner,
} from "../_game-engine";
import { rephraseQuestionWithCache } from "../_llm-rephrase";

// ── Types ────────────────────────────────────────────────────

interface ResumeRequest {
  sessionId: string;
}

type D1SessionRow = Omit<GameSessionsRow, "user_id" | "completed_at">;

type CharacterRow = Pick<
  CharactersRow,
  "id" | "name" | "category" | "image_url"
> & { attributes_json: string };

type QuestionRow = Pick<QuestionsRow, "id" | "text" | "attribute_key">;

function isMissingRetiredAtColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("no such column: retired_at");
}

async function loadQuestionsWithRetirementFallback(
  db: D1Database,
): Promise<QuestionRow[]> {
  try {
    return await d1Query<QuestionRow>(
      db,
      "SELECT id, text, attribute_key FROM questions WHERE retired_at IS NULL ORDER BY priority DESC",
    );
  } catch (error) {
    if (!isMissingRetiredAtColumnError(error)) throw error;
    return d1Query<QuestionRow>(
      db,
      "SELECT id, text, attribute_key FROM questions ORDER BY priority DESC",
    );
  }
}

// ── D1 fallback: reconstruct session from backup ─────────────

async function reconstructFromD1(
  db: D1Database,
  sessionId: string,
): Promise<GameSession | null> {
  const row = await d1First<D1SessionRow>(
    db,
    "SELECT id, character_ids, answers, current_question_attr, difficulty, max_questions, created_at FROM game_sessions WHERE id = ? AND completed_at IS NULL",
    [sessionId],
  );
  if (!row) return null;

  const charIds: string[] = JSON.parse(row.character_ids);
  const safeIds = charIds.filter((id) => /^[a-z0-9_-]+$/i.test(id));
  if (safeIds.length === 0) return null;

  const placeholders = safeIds.map(() => "?").join(",");

  // Check questions cache first (avoids a D1 round-trip for the questions query)
  const cachedQuestions = await loadCachedQuestions(db);

  // Re-fetch characters (with denormalized attributes_json) and optionally questions from D1
  const [characters, questionRows] = await Promise.all([
    d1Query<CharacterRow>(
      db,
      `SELECT id, name, category, image_url, attributes_json FROM characters WHERE id IN (${placeholders})`,
      safeIds,
    ),
    cachedQuestions
      ? Promise.resolve<QuestionRow[]>([])
      : loadQuestionsWithRetirementFallback(db),
  ]);

  const serverChars: ServerCharacter[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    imageUrl: c.image_url,
    attributes: parseAttrsJson(c.attributes_json),
  }));

  const serverQuestions: ServerQuestion[] =
    cachedQuestions ??
    questionRows.map((q) => ({
      id: q.id,
      text: q.text,
      attribute: q.attribute_key,
    }));
  if (!cachedQuestions && serverQuestions.length > 0) {
    storeCachedQuestions(db, serverQuestions).catch(() => {});
  }

  const answers: Answer[] = JSON.parse(row.answers);

  // Re-select current question based on answers
  const filtered = filterPossibleCharacters(serverChars, answers);
  const resumeOptions = {
    gameDifficulty: row.difficulty as "easy" | "medium" | "hard",
  };
  const currentQuestion = row.current_question_attr
    ? (serverQuestions.find((q) => q.attribute === row.current_question_attr) ??
      selectBestQuestion(filtered, answers, serverQuestions, resumeOptions))
    : selectBestQuestion(filtered, answers, serverQuestions, resumeOptions);

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
  };

  // Re-hydrate D1 session so subsequent requests are fast
  await storeSession(db, session);

  return session;
}

// ── POST /api/v2/game/resume ─────────────────────────────────
// Resumes an existing server session from KV, falling back to D1 backup

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request);
  const actorId = getActorId(context.request);
  const url = new URL(context.request.url);
  const respond = (response: Response): Response =>
    withRequestId(response, requestId);
  const internalError = (): Response =>
    respond(internalErrorResponse(requestId));

  try {
    const db = context.env.GUESS_DB;
    if (!db) return respond(errorResponse("D1 not configured", 503));

    const body = await parseJsonBody<ResumeRequest>(context.request);
    if (!body?.sessionId || typeof body.sessionId !== "string") {
      return respond(errorResponse("Missing sessionId", 400));
    }

    let session = await loadSession(db, body.sessionId);

    // D1 miss — try backup reconstruction (legacy sessions or edge cases)
    if (!session) {
      try {
        session = await reconstructFromD1(db, body.sessionId);
      } catch {
        // D1 reconstruction failed — treat as expired
      }
    }

    if (!session) {
      return respond(jsonResponse({ expired: true }, 200));
    }

    const { userId, setCookieHeader } = await getOrCreateUserId(
      context.request,
      context.env,
    );
    const respond2 = (r: Response): Response =>
      withSetCookie(respond(r), setCookieHeader);

    if (!verifySessionOwner(session, userId)) {
      return respond2(errorResponse("Forbidden", 403));
    }

    const filtered = filterPossibleCharacters(
      session.characters,
      session.answers,
      session.rejectedGuesses,
    );

    // Rebuild current state for the client
    const reasoning = session.currentQuestion
      ? generateReasoning(session.currentQuestion, filtered, session.answers)
      : null;

    // Parallelize: refresh session TTL + rephrase question (with cache for first questions)
    let rephrased: string | null = null;
    if (session.currentQuestion && reasoning) {
      [rephrased] = await Promise.all([
        rephraseQuestionWithCache(
          context.env,
          db,
          session.currentQuestion,
          session.answers,
          reasoning,
          session.answers.length + 1,
          session.maxQuestions,
          undefined,
          session.persona,
        ),
        saveSessionState(db, session),
      ]);
    } else {
      await saveSessionState(db, session);
    }
    if (rephrased && session.currentQuestion) {
      session.currentQuestion.displayText = rephrased;
    }

    return respond2(
      jsonResponse({
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
      }),
    );
  } catch (err) {
    console.error("POST /api/v2/game/resume error:", err);
    context.waitUntil(
      logError(context.env, "resume", "error", "resume failed", err, {
        requestId,
        actorId,
        path: url.pathname,
        method: context.request.method,
        status: 500,
      }),
    );
    return internalError();
  }
};
