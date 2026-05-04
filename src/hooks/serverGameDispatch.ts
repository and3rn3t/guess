import type { GameAction } from "@/hooks/useGameState";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Question,
  ReasoningExplanation,
} from "@/lib/types";

export type BootstrapDispatchStep =
  | { type: "start-game"; guessCount?: number }
  | { type: "set-question"; question: Question; reasoning: ReasoningExplanation }
  | { type: "answer"; value: AnswerValue };

export type AnswerDispatchStep =
  | { type: "undo-last-answer" }
  | { type: "set-question"; question: Question; reasoning: ReasoningExplanation }
  | {
      type: "make-guess";
      character: {
        id: string;
        name: string;
        category: string;
        imageUrl?: string;
        trivia?: string[];
      };
    };

export const applyBootstrapStep = (
  dispatch: React.Dispatch<GameAction>,
  step: BootstrapDispatchStep,
): void => {
  if (step.type === "start-game") {
    dispatch({
      type: "START_GAME",
      characters: [],
      guessCount: step.guessCount,
    });
    return;
  }

  if (step.type === "set-question") {
    dispatch({
      type: "SET_QUESTION",
      question: step.question,
      reasoning: step.reasoning,
    });
    return;
  }

  dispatch({ type: "ANSWER", value: step.value });
};

export const applyServerAnswerStep = (
  dispatch: React.Dispatch<GameAction>,
  step: AnswerDispatchStep,
): void => {
  if (step.type === "undo-last-answer") {
    dispatch({ type: "UNDO_LAST_ANSWER" });
    return;
  }

  if (step.type === "set-question") {
    dispatch({
      type: "SET_QUESTION",
      question: step.question,
      reasoning: step.reasoning,
    });
    return;
  }

  const guessChar: Character = {
    id: step.character.id,
    name: step.character.name,
    category: step.character.category as CharacterCategory,
    attributes: {},
    imageUrl: step.character.imageUrl,
    trivia: step.character.trivia,
  };
  dispatch({ type: "MAKE_GUESS", character: guessChar });
};
