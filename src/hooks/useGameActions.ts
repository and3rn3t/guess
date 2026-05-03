import { revealCharacter } from "@/lib/gameApi";
import {
  buildShareUrl,
  generateShareText,
} from "@/lib/sharing";
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  playAnswer,
  playCorrectGuess,
  playIncorrectGuess,
} from "@/lib/sounds";
import type {
  Answer,
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  Question,
} from "@/lib/types";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { GameAction, GamePhase } from "@/hooks/useGameState";

const analytics = () => import("@/lib/analytics");

export interface UseGameActionsOptions {
  categories: CharacterCategory[];
  difficulty: Difficulty;
  startServerGame: (
    categories: CharacterCategory[],
    difficulty: Difficulty,
    characterId?: string,
  ) => Promise<void>;
  resetElimination: () => void;
  setIsNewPersonalBest: (value: boolean) => void;
  dispatch: Dispatch<GameAction>;
  handleServerAnswer: (value: AnswerValue) => Promise<void>;
  updateBest: (questionCount: number) => boolean;
  gameSteps: Array<{ questionText: string; attribute: string; answer: AnswerValue }>;
  guessCount: number;
  postServerResult: (correct: boolean) => void;
  refreshStats: () => void;
  finalGuess: Character | null;
  rejectGuess: (characterId: string) => void;
  gamePhase: GamePhase;
  setShowQuitDialog: (show: boolean) => void;
  currentQuestion: Question | null;
  serverRemaining: number;
  handleServerSkip: () => void;
  gameWon: boolean;
  answers: Answer[];
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setQuestions: Dispatch<SetStateAction<Question[]>>;
  onGameCompleted?: (won: boolean, questionsAsked: number) => void | Promise<void>;
}

export function useGameActions(options: UseGameActionsOptions) {
  const {
    categories,
    difficulty,
    startServerGame,
    resetElimination,
    setIsNewPersonalBest,
    dispatch,
    handleServerAnswer,
    updateBest,
    gameSteps,
    guessCount,
    postServerResult,
    refreshStats,
    finalGuess,
    rejectGuess,
    gamePhase,
    setShowQuitDialog,
    currentQuestion,
    serverRemaining,
    handleServerSkip,
    gameWon,
    answers,
    setCharacters,
    setQuestions,
    onGameCompleted,
  } = options;

  const startGame = useCallback(async () => {
    setIsNewPersonalBest(false);
    resetElimination();
    await startServerGame(categories, difficulty);
  }, [categories, difficulty, resetElimination, setIsNewPersonalBest, startServerGame]);

  const startGameWithCharacter = useCallback(async (characterId: string) => {
    setIsNewPersonalBest(false);
    resetElimination();
    await startServerGame([], difficulty, characterId);
  }, [difficulty, resetElimination, setIsNewPersonalBest, startServerGame]);

  const handleAnswer = useCallback(async (value: AnswerValue) => {
    dispatch({ type: "ANSWER", value });
    playAnswer();
    hapticLight();
    await handleServerAnswer(value);
  }, [dispatch, handleServerAnswer]);

  const handleCorrectGuess = useCallback(() => {
    const isNewBest = updateBest(gameSteps.length);
    setIsNewPersonalBest(isNewBest);
    dispatch({ type: "CORRECT_GUESS" });
    analytics().then((m) =>
      m.trackGameEnd(true, difficulty, gameSteps.length, guessCount),
    );
    playCorrectGuess();
    hapticSuccess();
    toast.success("🎉 I got it right!");
    postServerResult(true);
    refreshStats();
    void onGameCompleted?.(true, gameSteps.length);
  }, [
    updateBest,
    gameSteps.length,
    setIsNewPersonalBest,
    dispatch,
    difficulty,
    guessCount,
    postServerResult,
    refreshStats,
    onGameCompleted,
  ]);

  const handleIncorrectGuess = useCallback(() => {
    dispatch({ type: "INCORRECT_GUESS" });
    analytics().then((m) =>
      m.trackGameEnd(false, difficulty, gameSteps.length, guessCount),
    );
    playIncorrectGuess();
    hapticMedium();
    toast.error("I'll learn from this and do better next time!");
    postServerResult(false);
    refreshStats();
    void onGameCompleted?.(false, gameSteps.length);
  }, [dispatch, difficulty, gameSteps.length, guessCount, postServerResult, refreshStats, onGameCompleted]);

  const handleRejectGuess = useCallback(() => {
    if (!finalGuess) return;
    playIncorrectGuess();
    hapticMedium();
    rejectGuess(finalGuess.id);
  }, [finalGuess, rejectGuess]);

  const handleSurrender = useCallback(() => {
    analytics().then((m) => {
      m.trackGameEnd(false, difficulty, gameSteps.length, guessCount);
      m.trackGameAbandon({
        reason: "quit",
        questionsAsked: gameSteps.length,
        phase: gamePhase,
      });
    });
    postServerResult(false);
    refreshStats();
    setShowQuitDialog(false);
    dispatch({ type: "SURRENDER" });
  }, [
    difficulty,
    gameSteps.length,
    guessCount,
    gamePhase,
    postServerResult,
    refreshStats,
    setShowQuitDialog,
    dispatch,
  ]);

  const handleSkip = useCallback(() => {
    if (currentQuestion) {
      analytics().then((m) =>
        m.trackQuestionSkip({
          questionId: currentQuestion.id,
          attribute: currentQuestion.attribute,
          questionsAsked: gameSteps.length,
          candidatesRemaining: serverRemaining,
        }),
      );
    }
    handleServerSkip();
  }, [currentQuestion, gameSteps.length, serverRemaining, handleServerSkip]);

  const getSharePayload = useCallback(() => {
    if (!finalGuess) return null;
    return {
      characterId: finalGuess.id,
      characterName: finalGuess.name,
      won: gameWon,
      difficulty,
      questionCount: gameSteps.length,
      steps: gameSteps,
    };
  }, [difficulty, finalGuess, gameWon, gameSteps]);

  const handleShare = useCallback(async () => {
    const payload = getSharePayload();
    if (!payload) return;
    const text = generateShareText(payload);
    const url = buildShareUrl(payload);
    if (navigator.share) {
      try {
        await navigator.share({ text: `${text}\n${url}` });
        analytics().then((m) => m.trackShare("native"));
      } catch {
        // User cancelled — ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        analytics().then((m) => m.trackShare("clipboard"));
        toast.success("Copied to clipboard!");
      } catch {
        toast.error("Could not copy to clipboard");
      }
    }
  }, [getSharePayload]);

  const handleCopyLink = useCallback(async () => {
    const payload = getSharePayload();
    if (!payload) return;
    const url = buildShareUrl(payload);
    try {
      await navigator.clipboard.writeText(url);
      analytics().then((m) => m.trackShare("link"));
      toast.success("Challenge link copied!");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [getSharePayload]);

  const handleReveal = useCallback(async (characterName: string) => {
    try {
      return await revealCharacter(
        characterName,
        answers.map((a) => ({ questionId: a.questionId, value: a.value })),
      );
    } catch {
      return { found: false };
    }
  }, [answers]);

  const handleAddCharacter = useCallback((character: Character) => {
    setCharacters((prev) => [...prev, character]);
    toast.success(`I've learned about ${character.name}!`);
  }, [setCharacters]);

  const handleAddQuestions = useCallback((newQuestions: Question[]) => {
    setQuestions((prev) => [...prev, ...newQuestions]);
  }, [setQuestions]);

  return {
    startGame,
    startGameWithCharacter,
    handleAnswer,
    handleCorrectGuess,
    handleIncorrectGuess,
    handleRejectGuess,
    handleSurrender,
    handleSkip,
    handleShare,
    handleCopyLink,
    handleReveal,
    handleAddCharacter,
    handleAddQuestions,
  };
}
