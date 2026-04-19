import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { GameAction } from "@/hooks/useGameState";
import { DEFAULT_QUESTIONS } from "@/lib/database";
import {
  detectContradictions,
  generateReasoning,
  getBestGuess,
  selectBestQuestion,
  shouldMakeGuess,
} from "@/lib/gameEngine";
import { playThinking, playSuspense } from "@/lib/sounds";
import type { AnswerValue, Character, Question } from "@/lib/types";

const loadPrompts = () => import("@/lib/prompts");
const loadLlm = () => import("@/lib/llm");

// ── Helpers ──────────────────────────────────────────────────

export function filterPossibleCharacters(
  chars: Character[],
  currentAnswers: { questionId: string; value: AnswerValue }[],
): Character[] {
  return chars.filter((char) => {
    for (const answer of currentAnswers) {
      const attr = char.attributes[answer.questionId];
      if (answer.value === "yes" && attr === false) return false;
      if (answer.value === "no" && attr === true) return false;
    }
    return true;
  });
}

// ── Hook ─────────────────────────────────────────────────────

interface UseLocalGameOptions {
  dispatch: React.Dispatch<GameAction>;
  questions: Question[] | null;
  possibleCharacters: Character[];
  answers: { questionId: string; value: AnswerValue }[];
  maxQuestions: number;
  llmMode: boolean;
  prevPossibleCount: React.MutableRefObject<number>;
  setEliminatedCount: (n: number | null) => void;
}

/**
 * Local-mode game logic: generates next question, detects
 * contradictions, and handles LLM rephrasing.
 */
export function useLocalGame({
  dispatch,
  questions,
  possibleCharacters,
  answers,
  maxQuestions,
  llmMode,
  prevPossibleCount,
  setEliminatedCount,
}: UseLocalGameOptions) {
  const llmAbortRef = useRef<AbortController | null>(null);

  const generateNextQuestion = useCallback(() => {
    dispatch({ type: "SET_THINKING", isThinking: true });
    playThinking();

    setTimeout(() => {
      const allQuestions = questions || DEFAULT_QUESTIONS;
      const filtered = filterPossibleCharacters(possibleCharacters, answers);
      dispatch({ type: "SET_POSSIBLE_CHARACTERS", characters: filtered });

      // Show elimination feedback
      if (prevPossibleCount.current > 0) {
        const eliminated = prevPossibleCount.current - filtered.length;
        if (eliminated > 0) {
          setEliminatedCount(eliminated);
          setTimeout(() => setEliminatedCount(null), 2000);
        }
      }

      const { hasContradiction } = detectContradictions(
        possibleCharacters,
        answers,
      );
      if (hasContradiction) {
        toast.warning(
          "Your answers seem contradictory — no characters match! Undoing last answer.",
        );
        dispatch({ type: "UNDO_LAST_ANSWER" });
        dispatch({ type: "SET_THINKING", isThinking: false });
        return;
      }

      if (shouldMakeGuess(filtered, answers, answers.length, maxQuestions)) {
        const guess = getBestGuess(filtered, answers);
        if (guess) {
          dispatch({ type: "MAKE_GUESS", character: guess });
          playSuspense();
        }
        return;
      }

      const nextQuestion = selectBestQuestion(filtered, answers, allQuestions);

      if (nextQuestion) {
        const newReasoning = generateReasoning(nextQuestion, filtered, answers);
        dispatch({
          type: "SET_QUESTION",
          question: nextQuestion,
          reasoning: newReasoning,
        });

        // LLM rephrasing (non-blocking, updates question text after)
        if (llmMode) {
          llmAbortRef.current?.abort();
          const controller = new AbortController();
          llmAbortRef.current = controller;

          const answeredQs = answers.map((a) => {
            const q = allQuestions.find(
              (q) => q.attribute === a.questionId,
            );
            return { question: q?.text || "", answer: a.value };
          });
          const topNames = filtered.slice(0, 5).map((c) => c.name);
          const conf = filtered.length > 0 ? 1 / filtered.length : 0;

          Promise.all([loadPrompts(), loadLlm()])
            .then(([{ dynamicQuestion_v1 }, { llmWithMeta }]) => {
              if (controller.signal.aborted) return null;
              const { system, user } = dynamicQuestion_v1(
                nextQuestion.text,
                nextQuestion.attribute,
                answeredQs,
                topNames,
                conf,
              );
              return llmWithMeta({
                prompt: user,
                model: "gpt-4o-mini",
                jsonMode: true,
                systemPrompt: system,
                signal: controller.signal,
              });
            })
            .then((result) => {
              if (!result) return;
              try {
                const parsed = JSON.parse(result.content) as { text: string };
                if (parsed.text && parsed.text.length < 150) {
                  dispatch({
                    type: "SET_QUESTION",
                    question: { ...nextQuestion, text: parsed.text },
                    reasoning: newReasoning,
                  });
                }
              } catch {
                /* Use original question */
              }
            })
            .catch(() => {
              /* Fallback: keep deterministic question */
            });
        }
      } else {
        const guess = getBestGuess(filtered, answers);
        if (guess) {
          dispatch({ type: "MAKE_GUESS", character: guess });
          playSuspense();
        }
      }

      dispatch({ type: "SET_THINKING", isThinking: false });
    }, 800);
  }, [
    dispatch,
    questions,
    possibleCharacters,
    answers,
    maxQuestions,
    llmMode,
    prevPossibleCount,
    setEliminatedCount,
  ]);

  return { generateNextQuestion, llmAbortRef };
}
