import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { GameAction } from "@/hooks/useGameState";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  Question,
  ReasoningExplanation,
} from "@/lib/types";
import { playThinking, playSuspense } from "@/lib/sounds";

const analytics = () => import("@/lib/analytics");

// ── Server response types ────────────────────────────────────

interface StartResponse {
  sessionId: string;
  question: Question;
  reasoning: ReasoningExplanation;
  totalCharacters: number;
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
  message?: string;
}

// ── Hook ─────────────────────────────────────────────────────

/**
 * Server-mode delegate: manages session ID, remaining count, and
 * server API calls.  Receives the shared game-state `dispatch` so
 * the main reducer stays the single source of truth.
 */
export function useServerGame(dispatch: React.Dispatch<GameAction>) {
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [serverRemaining, setServerRemaining] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);

  const startServerGame = useCallback(
    async (categories: CharacterCategory[], difficulty: Difficulty) => {
      dispatch({ type: "SET_THINKING", isThinking: true });
      playThinking();
      try {
        const res = await fetch("/api/v2/game/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: categories.length ? categories : undefined,
            difficulty,
          }),
        });
        if (!res.ok) throw new Error("Failed to start");
        const data = (await res.json()) as StartResponse;
        setServerSessionId(data.sessionId);
        setServerRemaining(data.totalCharacters);
        setServerTotal(data.totalCharacters);
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
    [dispatch],
  );

  const handleServerAnswer = useCallback(
    async (value: AnswerValue, prevCount: number) => {
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
            category: (data.character.category ||
              "other") as CharacterCategory,
            attributes: {},
            imageUrl: data.character.imageUrl ?? undefined,
          };
          dispatch({ type: "MAKE_GUESS", character: guessChar });
          setServerRemaining(data.remaining ?? 1);
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
          setServerRemaining(data.remaining ?? prevCount);
          toast.success(`Answer recorded: ${value}`);
        }
      } catch {
        toast.error("Failed to process answer — try again");
        dispatch({ type: "UNDO_LAST_ANSWER" });
      } finally {
        dispatch({ type: "SET_THINKING", isThinking: false });
      }
    },
    [dispatch, serverSessionId],
  );

  const postServerResult = useCallback(
    (correct: boolean) => {
      if (!serverSessionId) return;
      fetch("/api/v2/game/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: serverSessionId, correct }),
      }).catch(() => {});
      setServerSessionId(null);
    },
    [serverSessionId],
  );

  return {
    serverSessionId,
    serverRemaining,
    serverTotal,
    setServerRemaining,
    startServerGame,
    handleServerAnswer,
    postServerResult,
  };
}
