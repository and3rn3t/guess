import {
  type Env,
  errorResponse,
  getActorId,
  getOrCreateUserId,
  getRequestId,
  internalErrorResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
  withSetCookie,
} from "../../_helpers";
import { AnswerRequestSchema } from "../../_schemas";
import {
  calculateProbabilities,
  getOrBuildCoverageMap,
  loadSession,
  verifySessionOwner,
} from "../_game-engine";
import {
  computeResponseReadiness,
  continueWithNextQuestion,
  maybeFinalizeReadinessGuess,
  maybeHandleContradiction,
  prefetchAdaptiveData,
} from "./_answer_orchestration";
import { updatePosteriorHistory } from "./_posterior-history";
import { applyAnswerAndFilter } from "./_question-flow";
import {
  buildQuestionAttemptInput,
  queueQuestionAttemptWrite,
} from "./_turn-effects";

// ── POST /api/v2/game/answer ─────────────────────────────────
// Processes the user's answer, returns next question or a guess

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
      AnswerRequestSchema,
    );
    if (!parsed.success) return respond(parsed.response);
    const { sessionId, value } = parsed.data;

    const { userId, setCookieHeader } = await getOrCreateUserId(
      context.request,
      context.env,
    );
    const respond2 = (r: Response): Response =>
      withSetCookie(respond(r), setCookieHeader);

    // Load session
    const session = await loadSession(db, sessionId);
    if (!session) {
      return respond2(errorResponse("Session not found or expired", 404));
    }

    if (!verifySessionOwner(session, userId)) {
      return respond2(errorResponse("Forbidden", 403));
    }

    if (!session.currentQuestion) {
      return respond2(errorResponse("No pending question to answer", 400));
    }

    const { askedQuestion, questionIndex, candidatesBefore, filtered } =
      applyAnswerAndFilter(session, value);

    // Persist question_attempts row (fire-and-forget). Powers per-question empirical
    // info-gain analytics (kv:question-empirical-gain) and per-question skip/maybe rates.
    queueQuestionAttemptWrite(
      context.waitUntil,
      context.env.GUESS_DB,
      buildQuestionAttemptInput({
        sessionId,
        askedQuestion,
        answer: value,
        candidatesBefore,
        candidatesAfter: filtered.length,
        questionIndex,
        createdAt: Date.now(),
      }),
    );

    const coverageMap = getOrBuildCoverageMap(session);
    const scoring = { coverageMap, popularityMap: session.popularityMap };

    // Pre-compute probabilities once — reused by evaluateGuessReadiness and selectBestQuestion
    // to avoid redundant O(C×A) passes over the same data.
    const probs = calculateProbabilities(filtered, session.answers, scoring);

    // Kick off adaptive-data loading in parallel with readiness checks. This saves
    // one await in the common "continue asking" path while staying best-effort.
    const adaptivePromise = prefetchAdaptiveData(db);

    // AN.11/AN.21: record posterior history and top-10 after each answer.
    updatePosteriorHistory(session, probs, filtered);

    const contradictionResponse = await maybeHandleContradiction({
      db,
      session,
      filtered,
    });
    if (contradictionResponse) {
      return respond2(contradictionResponse);
    }

    const questionCount = session.answers.length;
    const responseReadiness = computeResponseReadiness({
      session,
      filtered,
      scoring,
      probs,
    });

    const readinessGuessResponse = await maybeFinalizeReadinessGuess({
      db,
      session,
      filtered,
      scoring,
      questionCount,
      remaining: filtered.length,
      readiness: responseReadiness,
    });
    if (readinessGuessResponse) {
      return respond2(readinessGuessResponse);
    }

    // Load runtime adaptive data (already in-flight; best-effort)
    const adaptive = await adaptivePromise;

    return respond2(
      await continueWithNextQuestion({
        env: context.env,
        waitUntil: context.waitUntil,
        db,
        session,
        filtered,
        scoring,
        adaptive,
        probs,
        questionCount,
        readiness: responseReadiness,
      }),
    );
  } catch (err) {
    console.error("POST /api/v2/game/answer error:", err);
    context.waitUntil(
      logError(
        context.env,
        "answer",
        "error",
        "answer processing failed",
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
