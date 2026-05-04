import type { GameAction } from "@/hooks/useGameState";
import {
  buildResumeBootstrapPlan,
  buildResumedSessionSnapshot,
  buildRejectReadinessSnapshot,
  buildServerAnswerActionPlan,
  buildServerAnswerOutcome,
  buildStartBootstrapPlan,
  canResumeServerSession,
  canContinueAfterSkip,
  classifyServerRejectResponse,
  buildCollectingEvidenceMessage,
  buildRetryGuessMessage,
  getRejectCooldownRemaining,
} from "@guess/app-core";
import { GAME_API_ENDPOINTS, SERVER_SESSION_KEY } from "@/lib/constants";
import {
  normalizeReadiness,
  rejectGuess as apiRejectGuess,
  reportFetchError,
  resumeGame,
  skipQuestion,
  startGame,
  submitAnswer,
  submitGameFeedback,
  submitResult,
} from "@/lib/gameApi";
import { runWhenIdle } from "@/lib/idle";
import { playSuspense, playThinking } from "@/lib/sounds";
import {
  applyBootstrapStep,
  applyServerAnswerStep,
} from "@/hooks/serverGameDispatch";
import type {
  AnswerValue,
  CharacterCategory,
  Difficulty,
  GuessReadinessSnapshot,
  Question,
  ReasoningExplanation,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const analytics = () => import("@/lib/analytics");

/**
 * Server game delegate: manages session ID, remaining count, and
 * server API calls.  Receives the shared game-state `dispatch` so
 * the main reducer stays the single source of truth.
 */
export function useServerGame(dispatch: React.Dispatch<GameAction>) {
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [lastCompletedSessionId, setLastCompletedSessionId] = useState<string | null>(null);
  const [serverRemaining, setServerRemaining] = useState(0);
  const serverRemainingRef = useRef(0);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverMaxQuestions, setServerMaxQuestions] = useState(0);
  const [serverReadiness, setServerReadiness] =
    useState<GuessReadinessSnapshot | null>(null);
  // Transient (non-fatal) error from the most recent server action.
  // Surfaced as an inline alert with a retry button rather than tripping
  // the React ErrorBoundary, which is reserved for unrecoverable errors.
  const [lastError, setLastError] = useState<{
    message: string;
    action: 'answer' | 'skip';
    payload?: AnswerValue;
  } | null>(null);
  const clearLastError = useCallback(() => setLastError(null), []);
  const resumeAttempted = useRef(false);
  const isSubmittingAnswer = useRef(false);

  // Keep ref in sync with state for stable closure access
  const setServerRemainingSync = useCallback((n: number) => {
    serverRemainingRef.current = n;
    setServerRemaining(n);
  }, []);

  // Persist session ID to sessionStorage
  const persistSessionId = useCallback((id: string | null) => {
    setServerSessionId(id);
    try {
      if (id) {
        sessionStorage.setItem(SERVER_SESSION_KEY, id);
      } else {
        sessionStorage.removeItem(SERVER_SESSION_KEY);
      }
    } catch {
      // sessionStorage unavailable — ignore
    }
  }, []);

  // Auto-resume server session on mount
  useEffect(() => {
    if (resumeAttempted.current) return;
    resumeAttempted.current = true;

    let savedId: string | null = null;
    try {
      savedId = sessionStorage.getItem(SERVER_SESSION_KEY);
    } catch {
      return;
    }
    if (!savedId) return;

    (async () => {
      try {
        const data = await resumeGame(savedId);
        if (!canResumeServerSession(data)) {
          persistSessionId(null);
          return;
        }
        const resumedSession = buildResumedSessionSnapshot<
          Question,
          ReasoningExplanation,
          AnswerValue,
          typeof data
        >(data);

        // Restore game state
        persistSessionId(savedId);
        setServerRemainingSync(resumedSession.remaining);
        setServerTotal(resumedSession.totalCharacters);
        setServerReadiness(null);
        for (
          const step of buildResumeBootstrapPlan<
            Question,
            ReasoningExplanation,
            AnswerValue,
            typeof data
          >(data)
        ) {
          applyBootstrapStep(dispatch, step);
        }

        toast.success("Previous session restored");
      } catch (err) {
        reportFetchError(GAME_API_ENDPOINTS.resume, err);
        persistSessionId(null);
      }
    })();
  }, [dispatch, persistSessionId, setServerRemainingSync]);

  const startServerGame = useCallback(
    async (
      categories: CharacterCategory[],
      difficulty: Difficulty,
      characterId?: string,
    ) => {
      dispatch({ type: "SET_THINKING", isThinking: true });
      playThinking();
      try {
        const data = await startGame({ categories, difficulty, characterId });
        persistSessionId(data.sessionId);
        setServerRemainingSync(data.totalCharacters);
        setServerTotal(data.totalCharacters);
        setServerReadiness(null);
        if (data.maxQuestions) setServerMaxQuestions(data.maxQuestions);
        for (
          const step of buildStartBootstrapPlan<Question, ReasoningExplanation>(
            data,
          )
        ) {
          applyBootstrapStep(dispatch, step);
        }
        analytics().then((m) =>
          m.trackGameStart(difficulty, data.totalCharacters),
        );
      } catch (err) {
        reportFetchError(GAME_API_ENDPOINTS.start, err);
        toast.error(
          "Failed to start server game — try again or switch to local mode",
        );
        dispatch({ type: "NAVIGATE", phase: "welcome" });
      } finally {
        dispatch({ type: "SET_THINKING", isThinking: false });
      }
    },
    [dispatch, persistSessionId, setServerRemainingSync],
  );

  const handleServerAnswer = useCallback(
    async (value: AnswerValue) => {
      if (isSubmittingAnswer.current) return;
      isSubmittingAnswer.current = true;
      setLastError(null);
      dispatch({ type: "SET_THINKING", isThinking: true });
      try {
        const data = await submitAnswer(serverSessionId ?? "", value);
        const outcome = buildServerAnswerOutcome<
          Question,
          ReasoningExplanation,
          Partial<GuessReadinessSnapshot>,
          typeof data
        >(data);
        const answerPlan = buildServerAnswerActionPlan(outcome);

        if (outcome.kind === "contradiction") {
          for (const step of answerPlan) {
            applyServerAnswerStep(dispatch, step);
          }
          toast.warning(outcome.message);
        } else if (outcome.kind === "guess") {
          for (const step of answerPlan) {
            applyServerAnswerStep(dispatch, step);
          }
          setServerRemaining(outcome.remaining);
          setServerReadiness(normalizeReadiness(outcome.readiness));
          playSuspense();
        } else if (outcome.kind === "question") {
          for (const step of answerPlan) {
            applyServerAnswerStep(dispatch, step);
          }
          setServerRemainingSync(outcome.remaining ?? serverRemainingRef.current);
          setServerReadiness(normalizeReadiness(outcome.readiness));
          if (outcome.readiness?.blockedByRejectCooldown) {
            const remaining = getRejectCooldownRemaining(outcome.readiness);
            toast.info(buildCollectingEvidenceMessage(remaining));
          } else {
            toast.success(`Answer recorded: ${value}`);
          }
        }
      } catch (err) {
        reportFetchError(GAME_API_ENDPOINTS.answer, err);
        const message =
          err instanceof Error ? err.message : "Failed to process answer";
        setLastError({ message, action: "answer", payload: value });
        toast.error("Failed to process answer — tap Retry below");
        dispatch({ type: "UNDO_LAST_ANSWER" });
      } finally {
        isSubmittingAnswer.current = false;
        dispatch({ type: "SET_THINKING", isThinking: false });
      }
    },
    [dispatch, serverSessionId, setServerRemainingSync],
  );

  const postServerResult = useCallback(
    (correct: boolean) => {
      if (!serverSessionId) return;
      const sessionId = serverSessionId;
      setLastCompletedSessionId(sessionId);
      // Defer the result POST to idle time so it doesn't compete with the
      // reveal/confetti animation on the main thread.
      runWhenIdle(() => {
        submitResult(sessionId, correct)
          .catch(() => submitResult(sessionId, correct))
          .catch(() => {});
      });
      persistSessionId(null);
    },
    [serverSessionId, persistSessionId],
  );

  const submitPostGameFeedback = useCallback(
    async (rating: number, feedbackText?: string) => {
      const sessionId = lastCompletedSessionId;
      if (!sessionId) {
        throw new Error("No completed session available for feedback");
      }
      await submitGameFeedback(sessionId, rating, feedbackText);
    },
    [lastCompletedSessionId],
  );

  const lastRejectedCharRef = useRef<string | null>(null);

  const rejectGuess = useCallback(
    async (characterId: string) => {
      if (!serverSessionId) return;
      lastRejectedCharRef.current = characterId;
      dispatch({ type: "REJECT_GUESS" });
      try {
        const data = await apiRejectGuess(serverSessionId, characterId);
        const responseKind = classifyServerRejectResponse(data);

        if (responseKind === "exhausted") {
          dispatch({ type: "SET_EXHAUSTED" });
          postServerResult(false);
          analytics().then((m) =>
            m.trackGameEnd(
              false,
              "medium",
              data.questionCount ?? 0,
              data.guessCount ?? 0,
              true,
            ),
          );
        } else if (responseKind === "question" && data.question && data.reasoning) {
          dispatch({
            type: "SET_QUESTION",
            question: data.question,
            reasoning: data.reasoning,
          });
          setServerRemainingSync(data.remaining ?? 0);
          setServerReadiness(buildRejectReadinessSnapshot(data.rejectCooldownRemaining));
          if (data.maxQuestions) setServerMaxQuestions(data.maxQuestions);
          const cooldown = getRejectCooldownRemaining(data);
          toast.info(buildRetryGuessMessage(cooldown));
        } else {
          // Unexpected response shape — treat as error so user can retry
          throw new Error("Unexpected server response after rejecting guess");
        }
      } catch (err) {
        reportFetchError(GAME_API_ENDPOINTS.rejectGuess, err);
        toast.error("Something went wrong — tap 'Try Again' to continue");
      } finally {
        dispatch({ type: "SET_THINKING", isThinking: false });
      }
    },
    [dispatch, serverSessionId, postServerResult, setServerRemainingSync],
  );

  const retryAfterReject = useCallback(() => {
    const charId = lastRejectedCharRef.current;
    if (!charId || !serverSessionId) return;
    dispatch({ type: "SET_THINKING", isThinking: true });
    rejectGuess(charId);
  }, [rejectGuess, serverSessionId, dispatch]);

  const handleServerSkip = useCallback(async () => {
    if (!serverSessionId) return;
    setLastError(null);
    dispatch({ type: "SKIP_QUESTION" });
    try {
      const data = await skipQuestion(serverSessionId);
      if (!canContinueAfterSkip(data)) {
        toast.info("No more questions to skip to!");
        dispatch({ type: "SET_EXHAUSTED" });
        return;
      }
      dispatch({
        type: "SET_QUESTION",
        question: data.question,
        reasoning: data.reasoning,
      });
      setServerRemainingSync(data.remaining ?? serverRemainingRef.current);
    } catch (err) {
      reportFetchError(GAME_API_ENDPOINTS.skip, err);
      const message = err instanceof Error ? err.message : "Failed to skip";
      setLastError({ message, action: "skip" });
      toast.error("Failed to skip — tap Retry below");
      dispatch({ type: "SET_THINKING", isThinking: false });
    }
  }, [dispatch, serverSessionId, setServerRemainingSync]);

  const retryLastAction = useCallback(() => {
    if (!lastError) return;
    const { action, payload } = lastError;
    setLastError(null);
    if (action === "answer" && payload) void handleServerAnswer(payload);
    else if (action === "skip") void handleServerSkip();
  }, [lastError, handleServerAnswer, handleServerSkip]);

  return {
    serverSessionId,
    serverRemaining,
    serverTotal,
    serverMaxQuestions,
    serverReadiness,
    setServerRemaining: setServerRemainingSync,
    startServerGame,
    handleServerAnswer,
    handleServerSkip,
    postServerResult,
    rejectGuess,
    retryAfterReject,
    submitPostGameFeedback,
    lastError,
    clearLastError,
    retryLastAction,
  };
}
