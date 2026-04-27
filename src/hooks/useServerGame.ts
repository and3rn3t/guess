import type { GameAction } from "@/hooks/useGameState";
import {
  normalizeReadiness,
  rejectGuess as apiRejectGuess,
  reportFetchError,
  resumeGame,
  skipQuestion,
  startGame,
  submitAnswer,
  submitResult,
} from "@/lib/gameApi";
import { runWhenIdle } from "@/lib/idle";
import { playSuspense, playThinking } from "@/lib/sounds";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  GuessReadinessSnapshot,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const analytics = () => import("@/lib/analytics");

const SERVER_SESSION_KEY = "server-session-id";

/**
 * Server game delegate: manages session ID, remaining count, and
 * server API calls.  Receives the shared game-state `dispatch` so
 * the main reducer stays the single source of truth.
 */
export function useServerGame(dispatch: React.Dispatch<GameAction>) {
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [serverRemaining, setServerRemaining] = useState(0);
  const serverRemainingRef = useRef(0);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverMaxQuestions, setServerMaxQuestions] = useState(0);
  const [serverReadiness, setServerReadiness] =
    useState<GuessReadinessSnapshot | null>(null);
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
        if (!data || data.expired || !data.question || !data.reasoning) {
          persistSessionId(null);
          return;
        }

        // Restore game state
        persistSessionId(savedId);
        setServerRemainingSync(data.remaining ?? 0);
        setServerTotal(data.totalCharacters ?? 0);
        setServerReadiness(null);
        dispatch({
          type: "START_GAME",
          characters: [],
          guessCount: data.guessCount ?? 0,
        });

        // Replay answers into reducer so step count is correct
        if (data.answers) {
          for (const a of data.answers) {
            dispatch({
              type: "SET_QUESTION",
              question: { id: a.questionId, text: "", attribute: a.questionId },
              reasoning: {
                why: "",
                impact: "",
                remaining: 0,
                confidence: 0,
                topCandidates: [],
              },
            });
            dispatch({ type: "ANSWER", value: a.value });
          }
        }

        // Set current question
        dispatch({
          type: "SET_QUESTION",
          question: data.question,
          reasoning: data.reasoning,
        });

        toast.success("Previous session restored");
      } catch (err) {
        reportFetchError("/api/v2/game/resume", err);
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
        dispatch({ type: "START_GAME", characters: [] });
        dispatch({
          type: "SET_QUESTION",
          question: data.question,
          reasoning: data.reasoning,
        });
        analytics().then((m) =>
          m.trackGameStart(difficulty, data.totalCharacters),
        );
      } catch (err) {
        reportFetchError("/api/v2/game/start", err);
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
      dispatch({ type: "SET_THINKING", isThinking: true });
      try {
        const data = await submitAnswer(serverSessionId ?? "", value);

        if (data.type === "contradiction") {
          dispatch({ type: "UNDO_LAST_ANSWER" });
          toast.warning(
            data.message || "Contradictory answers — undoing last answer.",
          );
          if (data.question && data.reasoning) {
            dispatch({
              type: "SET_QUESTION",
              question: data.question,
              reasoning: data.reasoning,
            });
          }
        } else if (data.type === "guess" && data.character) {
          const guessChar: Character = {
            id: data.character.id,
            name: data.character.name,
            category: (data.character.category || "other") as CharacterCategory,
            attributes: {},
            imageUrl: data.character.imageUrl ?? undefined,
          };
          dispatch({ type: "MAKE_GUESS", character: guessChar });
          setServerRemaining(data.remaining ?? 1);
          setServerReadiness(normalizeReadiness(data.readiness));
          playSuspense();
        } else if (
          data.type === "question" &&
          data.question &&
          data.reasoning
        ) {
          dispatch({
            type: "SET_QUESTION",
            question: data.question,
            reasoning: data.reasoning,
          });
          setServerRemainingSync(data.remaining ?? serverRemainingRef.current);
          setServerReadiness(normalizeReadiness(data.readiness));
          if (data.readiness?.blockedByRejectCooldown) {
            const remaining = data.readiness.rejectCooldownRemaining ?? 0;
            const suffix =
              remaining > 0 ? ` (${remaining} more before next guess)` : "";
            toast.info(`Collecting more evidence before guessing${suffix}`);
          } else {
            toast.success(`Answer recorded: ${value}`);
          }
        }
      } catch (err) {
        reportFetchError("/api/v2/game/answer", err);
        toast.error("Failed to process answer — try again");
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

  const lastRejectedCharRef = useRef<string | null>(null);

  const rejectGuess = useCallback(
    async (characterId: string) => {
      if (!serverSessionId) return;
      lastRejectedCharRef.current = characterId;
      dispatch({ type: "REJECT_GUESS" });
      try {
        const data = await apiRejectGuess(serverSessionId, characterId);

        if (data.type === "exhausted") {
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
        } else if (
          data.type === "question" &&
          data.question &&
          data.reasoning
        ) {
          dispatch({
            type: "SET_QUESTION",
            question: data.question,
            reasoning: data.reasoning,
          });
          setServerRemainingSync(data.remaining ?? 0);
          setServerReadiness({
            trigger: "insufficient_data",
            blockedByRejectCooldown: (data.rejectCooldownRemaining ?? 0) > 0,
            rejectCooldownRemaining: data.rejectCooldownRemaining ?? 0,
          });
          if (data.maxQuestions) setServerMaxQuestions(data.maxQuestions);
          const cooldown = data.rejectCooldownRemaining ?? 0;
          const suffix =
            cooldown > 0 ? ` (${cooldown} more before next guess)` : "";
          toast.info(`I'll keep trying — let me ask more questions${suffix}!`);
        } else {
          // Unexpected response shape — treat as error so user can retry
          throw new Error("Unexpected server response after rejecting guess");
        }
      } catch (err) {
        reportFetchError("/api/v2/game/reject-guess", err);
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
    dispatch({ type: "SKIP_QUESTION" });
    try {
      const data = await skipQuestion(serverSessionId);
      if (!data) {
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
      reportFetchError("/api/v2/game/skip", err);
      toast.error("Failed to skip — try again");
      dispatch({ type: "SET_THINKING", isThinking: false });
    }
  }, [dispatch, serverSessionId, setServerRemainingSync]);

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
  };
}
