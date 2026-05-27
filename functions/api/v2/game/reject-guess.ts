import {
  type Env,
  errorResponse,
  getActorId,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
  withSetCookie,
} from "../../_helpers";
import { RejectGuessRequestSchema } from "../../_schemas";
import {
  BONUS_QUESTIONS_PER_REJECT,
  DIFFICULTY_MAP,
  filterPossibleCharacters,
  generateReasoning,
  loadAdaptiveData,
  loadSession,
  saveSessionState,
  verifySessionOwner,
} from "../_game-engine";
import { advanceToNextQuestion } from "./_question-flow";
import { selectNextQuestionForTurn } from "./_question-selection";
import { buildExhaustedResponse, buildQuestionResponse } from "./_responses";
import { queueRejectSessionSync } from "./_turn-effects";

// ── POST /api/v2/game/reject-guess ───────────────────────────
// User rejected the AI's guess. Exclude that character, extend
// question budget, and return the next question — or signal
// exhaustion if no viable candidates remain.

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

    const parsed = await parseJsonBodyWithSchema(
      context.request,
      RejectGuessRequestSchema,
    );
    if (!parsed.success) return respond(parsed.response);
    const { sessionId, characterId: rejectedCharId } = parsed.data;

    const { userId, setCookieHeader } = await getOrCreateUserId(
      context.request,
      context.env,
    );
    const respond2 = (r: Response): Response =>
      withSetCookie(respond(r), setCookieHeader);

    const session = await loadSession(db, sessionId);
    if (!session) {
      return respond2(errorResponse("Session not found or expired", 404));
    }

    if (!verifySessionOwner(session, userId)) {
      return respond2(errorResponse("Forbidden", 403));
    }

    // Add rejected character
    if (!session.rejectedGuesses.includes(rejectedCharId)) {
      session.rejectedGuesses.push(rejectedCharId);
    }

    // Extend question budget (bonus per rejection, capped at base × 2)
    const baseBudget = DIFFICULTY_MAP[session.difficulty] ?? 15;
    const bonus = BONUS_QUESTIONS_PER_REJECT[session.difficulty] ?? 2;

    // Rarity factor: smaller remaining pool → fewer bonus questions
    const filtered = filterPossibleCharacters(
      session.characters,
      session.answers,
      session.rejectedGuesses,
    );
    const effectiveBonus =
      filtered.length < 10 ? Math.max(1, Math.floor(bonus / 2)) : bonus;
    // Cap at baseBudget+10 to prevent runaway serial-rejection games on easy mode
    const hardCap = baseBudget + 10;

    session.maxQuestions = Math.min(
      session.maxQuestions + effectiveBonus,
      hardCap,
    );

    // Require extra evidence after a wrong guess: ask 1-2 more answers before allowing another guess.
    // Cooldown is capped at effectiveBonus-1 so at least one bonus question is always "free"
    // (otherwise the entire bonus is locked in cooldown, providing no real benefit).
    const questionsRemaining = Math.max(
      0,
      session.maxQuestions - session.answers.length,
    );
    const desiredCooldown = filtered.length > 12 ? 2 : 1;
    session.postRejectCooldown = Math.min(
      desiredCooldown,
      effectiveBonus - 1,
      questionsRemaining,
    );

    // Check if any viable candidates remain
    if (filtered.length === 0) {
      await saveSessionState(db, session);
      return respond2(
        jsonResponse(
          buildExhaustedResponse({
            message: "I've run out of candidates — you stumped me!",
            questionCount: session.answers.length,
            guessCount: session.guessCount,
            rejectCooldownRemaining: session.postRejectCooldown,
          }),
        ),
      );
    }

    // Select next question
    const scoring = {
      coverageMap: session.coverageMap,
      popularityMap: session.popularityMap,
    };

    // Load runtime adaptive data (parallel — best-effort, failures are non-fatal)
    const adaptive = await loadAdaptiveData(db);

    const nextQuestion = selectNextQuestionForTurn({
      session,
      filtered,
      questions: session.questions,
      scoring,
      adaptive,
    });

    if (!nextQuestion) {
      // No more unanswered questions but candidates remain — exhausted
      await saveSessionState(db, session);
      return respond2(
        jsonResponse(
          buildExhaustedResponse({
            message: "I've run out of questions to ask — you stumped me!",
            questionCount: session.answers.length,
            guessCount: session.guessCount,
            rejectCooldownRemaining: session.postRejectCooldown,
          }),
        ),
      );
    }

    const reasoning = generateReasoning(
      nextQuestion,
      filtered,
      session.answers,
      scoring,
    );

    await advanceToNextQuestion({
      env: context.env,
      db,
      session,
      nextQuestion,
      reasoning,
      questionNumber: session.answers.length + 1,
    });

    // Sync to D1 backup (non-blocking)
    queueRejectSessionSync(context.waitUntil, db, {
      sessionId: session.id,
      currentQuestionAttr: nextQuestion.attribute,
      maxQuestions: session.maxQuestions,
    });

    return respond2(
      jsonResponse(
        buildQuestionResponse({
          question: nextQuestion,
          reasoning,
          remaining: filtered.length,
          questionCount: session.answers.length,
          maxQuestions: session.maxQuestions,
          guessCount: session.guessCount,
          rejectCooldownRemaining: session.postRejectCooldown,
        }),
      ),
    );
  } catch (err) {
    console.error("POST /api/v2/game/reject-guess error:", err);
    context.waitUntil(
      logError(
        context.env,
        "reject-guess",
        "error",
        "reject-guess failed",
        err,
        {
          requestId,
          actorId,
          path: url.pathname,
          method: context.request.method,
          status: 500,
        },
      ),
    );
    return internalError();
  }
};
