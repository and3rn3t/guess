import {
  d1Run,
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
import { ResultRequestSchema } from "../../_schemas";
import { computeAhaMoment } from "../../admin/_aha";
import { buildStepsJson, detectCatastrophicFailure } from "../../admin/_triage";
import { deleteSession, getBestGuess, loadSession, verifySessionOwner } from "../_game-engine";

// ── POST /api/v2/game/result ─────────────────────────────────
// Records game outcome (win/loss) and cleans up the session

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
    if (!db) return respond(errorResponse("DB not configured", 503));

    const parsed = await parseJsonBodyWithSchema(
      context.request,
      ResultRequestSchema,
    );
    if (!parsed.success) return respond(parsed.response);
    const {
      sessionId,
      correct,
      actualCharacterId: _actualCharacterId,
    } = parsed.data;

    // Load session
    const session = await loadSession(db, sessionId);
    if (!session) {
      return respond(errorResponse("Session not found or expired", 404));
    }

    const { userId, setCookieHeader } = await getOrCreateUserId(
      context.request,
      context.env,
    );

    if (!verifySessionOwner(session, userId)) {
      return withSetCookie(respond(errorResponse("Forbidden", 403)), setCookieHeader);
    }

    // Compute aha moment (AN.11): index and magnitude of biggest posterior jump
    const ahaMoment = computeAhaMoment(session.posteriorHistory ?? []);
    // Resolve the attribute key for the aha step (if any)
    const ahaAttr =
      ahaMoment != null
        ? (session.answers[ahaMoment.index]?.questionId ?? null)
        : null;
    const ahaJump = ahaMoment?.jump ?? null;

    // Build steps from session answers + questions
    const steps = session.answers.map((a) => {
      const q = session.questions.find((q) => q.attribute === a.questionId);
      return {
        questionText: q?.text ?? a.questionId,
        attribute: a.questionId,
        answer: a.value,
      };
    });

    // Find the guessed character (the top candidate)
    let characterId: string | null = null;
    let characterName: string | null = null;
    if (session.characters.length > 0) {
      const guess = getBestGuess(
        session.characters,
        session.answers,
        session.rejectedGuesses,
      );
      if (guess) {
        characterId = guess.id;
        characterName = guess.name;
      }
    }

    // Record stats in D1 if available (non-blocking — offloaded to waitUntil)
    if (db) {
      context.waitUntil(
        d1Run(
          db,
          `INSERT INTO game_stats (user_id, won, difficulty, questions_asked, character_pool_size, character_id, character_name, steps, guesses_used, confidence_at_guess, entropy_at_guess, remaining_at_guess, answer_distribution, guess_trigger, forced_guess, gap_at_guess, alive_count_at_guess, questions_remaining_at_guess, variant, selector, aha_attr, aha_jump, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            correct ? 1 : 0,
            session.difficulty,
            session.answers.length,
            session.characters.length,
            characterId,
            characterName,
            JSON.stringify(steps),
            session.guessCount,
            session.guessAnalytics?.confidence ?? null,
            session.guessAnalytics?.entropy ?? null,
            session.guessAnalytics?.remaining ?? null,
            session.guessAnalytics?.answerDistribution
              ? JSON.stringify(session.guessAnalytics.answerDistribution)
              : null,
            session.guessAnalytics?.trigger ?? null,
            session.guessAnalytics?.forced ? 1 : 0,
            session.guessAnalytics?.gap ?? null,
            session.guessAnalytics?.aliveCount ?? null,
            session.guessAnalytics?.questionsRemaining ?? null,
            session.variant ?? "control",
            session.selector ?? "mcts",
            ahaAttr,
            ahaJump,
            Date.now(),
          ],
        ).catch(() => {
          /* non-critical */
        }),
      );
    }

    // AN.21: if game was lost and actual character was never in any top-10, queue for triage
    const actualCharacterId = _actualCharacterId;
    if (
      db &&
      !correct &&
      actualCharacterId &&
      session.stepTopTen &&
      session.stepTopTen.length > 0
    ) {
      if (detectCatastrophicFailure(actualCharacterId, session.stepTopTen)) {
        const steps = buildStepsJson(
          session.answers,
          session.questions,
          session.stepTopTen,
        );
        const actualChar = session.characters.find(
          (c) => c.id === actualCharacterId,
        );
        context.waitUntil(
          d1Run(
            db,
            `INSERT INTO triage_queue (actual_character_id, actual_character_name, min_rank, steps_json, created_at)
           VALUES (?, ?, ?, ?, ?)`,
            [
              actualCharacterId,
              actualChar?.name ?? null,
              null,
              JSON.stringify(steps),
              Date.now(),
            ],
          ).catch(() => {
            /* non-critical */
          }),
        );
      }
    }

    // Clean up session from D1
    await deleteSession(db, sessionId);

    // Mark D1 backup as completed (non-blocking)
    if (db) {
      context.waitUntil(
        d1Run(
          db,
          "UPDATE game_sessions SET completed_at = ?, dropped_at_phase = NULL WHERE id = ?",
          [Date.now(), sessionId],
        ).catch(() => {
          /* non-critical */
        }),
      );
    }

    return respond(
      withSetCookie(
        jsonResponse({
          success: true,
          summary: {
            won: correct,
            difficulty: session.difficulty,
            questionsAsked: session.answers.length,
            maxQuestions: session.maxQuestions,
            poolSize: session.characters.length,
            guessesUsed: session.guessCount,
          },
        }),
        setCookieHeader,
      ),
    );
  } catch (err) {
    console.error("POST /api/v2/game/result error:", err);
    context.waitUntil(
      logError(
        context.env.GUESS_DB,
        "result",
        "error",
        "result recording failed",
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
