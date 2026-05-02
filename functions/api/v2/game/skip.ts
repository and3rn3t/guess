import {
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  internalErrorResponse,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
} from "../../_helpers";
import { SkipRequestSchema } from "../../_schemas";
import {
  calculateProbabilities,
  filterPossibleCharacters,
  generateReasoning,
  getOrBuildCoverageMap,
  loadAdaptiveData,
  loadSession,
  saveSessionState,
} from "../_game-engine";
import { advanceToNextQuestion } from "./_question-flow";
import {
  getRecentQuestionCategories,
  selectNextQuestionForTurn,
} from "./_question-selection";
import { buildQuestionResponse } from "./_responses";

// ── POST /api/v2/game/skip ───────────────────────────────────
// Skips the current question (free — does not decrement questionsRemaining).
// Returns the next best question from the remaining un-skipped pool.

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request);
  const actorId = getActorId(context.request);
  const url = new URL(context.request.url);
  const respond = (response: Response): Response =>
    withRequestId(response, requestId);
  const internalError = (): Response =>
    respond(internalErrorResponse(requestId));

  try {
    const kv = context.env.GUESS_KV;
    if (!kv) return respond(errorResponse("KV not configured", 503));

    const parsed = await parseJsonBodyWithSchema(
      context.request,
      SkipRequestSchema,
    );
    if (!parsed.success) return respond(parsed.response);
    const { sessionId } = parsed.data;

    const session = await loadSession(kv, sessionId);
    if (!session) {
      return respond(errorResponse("Session not found or expired", 404));
    }

    if (!session.currentQuestion) {
      return respond(errorResponse("No pending question to skip", 400));
    }

    // Record the skipped question so it is excluded from future selection
    const skippedAttr = session.currentQuestion.attribute;
    if (!session.skippedQuestions.includes(skippedAttr)) {
      session.skippedQuestions.push(skippedAttr);
    }
    session.currentQuestion = null;

    // Compute filtered candidates
    const filtered = filterPossibleCharacters(
      session.characters,
      session.answers,
      session.rejectedGuesses,
    );

    const coverageMap = getOrBuildCoverageMap(session);
    const scoring = { coverageMap, popularityMap: session.popularityMap };
    const probs = calculateProbabilities(filtered, session.answers, scoring);

    // Load runtime adaptive data (parallel — best-effort, failures are non-fatal)
    const db = context.env.GUESS_DB;
    const adaptive = await loadAdaptiveData(kv, db);

    // Select next question, excluding all previously skipped ones
    const availableQuestions = session.questions.filter(
      (q) => !session.skippedQuestions.includes(q.attribute),
    );

    const questionCount = session.answers.length;

    const nextQuestion = selectNextQuestionForTurn({
      session,
      filtered,
      questions: availableQuestions,
      scoring,
      adaptive,
      probs,
      recentCategories: getRecentQuestionCategories(session),
    });

    if (!nextQuestion) {
      // All questions exhausted — save state and signal the client
      await saveSessionState(kv, session);
      return respond(
        errorResponse("No more questions available to skip to", 409),
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
      kv,
      session,
      nextQuestion,
      reasoning,
      questionNumber: questionCount + 1,
    });

    return respond(
      jsonResponse(
        buildQuestionResponse({
          question: nextQuestion,
          reasoning,
          remaining: filtered.length,
          questionCount,
          skippedCount: session.skippedQuestions.length,
        }),
      ),
    );
  } catch (err) {
    console.error("POST /api/v2/game/skip error:", err);
    context.waitUntil(
      logError(context.env.GUESS_DB, "skip", "error", "skip failed", err, {
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
