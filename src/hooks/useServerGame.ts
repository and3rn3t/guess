import type { GameAction } from "@/hooks/useGameState";
import { playSuspense, playThinking } from "@/lib/sounds";
import { runWhenIdle } from "@/lib/idle";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  GuessReadinessSnapshot,
  Question,
  ReasoningExplanation,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const analytics = () => import("@/lib/analytics");

const SERVER_SESSION_KEY = "server-session-id";

// ── Server response types ────────────────────────────────────

interface StartResponse {
  sessionId: string;
  question: Question;
  reasoning: ReasoningExplanation;
  totalCharacters: number;
  maxQuestions?: number;
}

interface AnswerResponse {
  type: "question" | "guess" | "contradiction";
  question?: Question;
  reasoning?: ReasoningExplanation;
  character?: {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
  };
  confidence?: number;
  remaining?: number;
  eliminated?: number;
  questionCount?: number;
  guessCount?: number;
  message?: string;
  readiness?: {
    trigger?: GuessReadinessSnapshot["trigger"];
    blockedByRejectCooldown?: boolean;
    rejectCooldownRemaining?: number;
    topProbability?: number;
    gap?: number;
    aliveCount?: number;
    questionsRemaining?: number;
    forced?: boolean;
  };
}

interface SkipResponse {
  type: "question";
  question: Question;
  reasoning: ReasoningExplanation;
  remaining: number;
  questionCount: number;
  skippedCount: number;
}

interface RejectGuessResponse {
  type: "question" | "exhausted";
  question?: Question;
  reasoning?: ReasoningExplanation;
  remaining?: number;
  questionCount?: number;
  maxQuestions?: number;
  guessCount?: number;
  rejectCooldownRemaining?: number;
  message?: string;
}

interface ResumeResponse {
  expired: boolean;
  question?: Question;
  reasoning?: ReasoningExplanation;
  remaining?: number;
  totalCharacters?: number;
  questionCount?: number;
  guessCount?: number;
  answers?: Array<{ questionId: string; value: AnswerValue }>;
}

function normalizeReadiness(
  readiness?: Partial<GuessReadinessSnapshot> | null,
): GuessReadinessSnapshot | null {
  if (!readiness) return null;

  return {
    trigger: readiness.trigger ?? "insufficient_data",
    blockedByRejectCooldown: readiness.blockedByRejectCooldown ?? false,
    rejectCooldownRemaining: readiness.rejectCooldownRemaining ?? 0,
    topProbability: readiness.topProbability,
    gap: readiness.gap,
    aliveCount: readiness.aliveCount,
    questionsRemaining: readiness.questionsRemaining,
    forced: readiness.forced,
  };
}

// ── Hook ─────────────────────────────────────────────────────

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
        const res = await fetch("/api/v2/game/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: savedId }),
        });
        if (!res.ok) {
          persistSessionId(null);
          return;
        }
        const data = (await res.json()) as ResumeResponse;
        if (data.expired || !data.question || !data.reasoning) {
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
      } catch {
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
        const res = await fetch("/api/v2/game/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: categories.length ? categories : undefined,
            difficulty,
            characterId: characterId ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed to start");
        const data = (await res.json()) as StartResponse;
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
      } catch {
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
        const res = await fetch("/api/v2/game/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: serverSessionId, value }),
        });
        if (!res.ok) throw new Error("Failed to process answer");
        const data = (await res.json()) as AnswerResponse;

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
      } catch {
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
      const body = JSON.stringify({ sessionId: serverSessionId, correct });
      const attempt = () =>
        fetch("/api/v2/game/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      // Defer the result POST to idle time so it doesn't compete with the
      // reveal/confetti animation on the main thread.
      runWhenIdle(() => {
        attempt()
          .catch(() => attempt())
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
        const res = await fetch("/api/v2/game/reject-guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: serverSessionId, characterId }),
        });
        if (!res.ok) throw new Error("Failed to reject guess");
        const data = (await res.json()) as RejectGuessResponse;

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
      } catch {
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
      const res = await fetch("/api/v2/game/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: serverSessionId }),
      });
      if (res.status === 409) {
        toast.info("No more questions to skip to!");
        dispatch({ type: "SET_EXHAUSTED" });
        return;
      }
      if (!res.ok) throw new Error("Failed to skip question");
      const data = (await res.json()) as SkipResponse;
      dispatch({
        type: "SET_QUESTION",
        question: data.question,
        reasoning: data.reasoning,
      });
      setServerRemainingSync(data.remaining ?? serverRemainingRef.current);
    } catch {
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
