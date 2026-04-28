import type { Achievement } from "@/hooks/useAchievements";
import type {
  GameAction,
  GamePhase,
  GameState,
} from "@/hooks/useGameState";
import type { GlobalStats } from "@/hooks/useGlobalStats";
import type { WeeklyRecap } from "@/hooks/useWeeklyRecap";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  GameHistoryEntry,
  GuessReadinessSnapshot,
  Persona,
  Question,
} from "@/lib/types";
import { createContext, useContext, type Dispatch, type RefObject } from "react";

export interface RevealResult {
  found: boolean;
  characterName?: string | null;
  attributesFilled?: number;
}

export interface GameContextValue {
  // Game state
  game: GameState;
  dispatch: Dispatch<GameAction>;
  navigate: (phase: GamePhase, character?: Character) => void;

  // Settings
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  categories: CharacterCategory[];
  setCategories: (c: CharacterCategory[]) => void;
  persona: Persona;
  maxQuestions: number;

  // Data collections
  characters: Character[] | null;
  questions: Question[] | null;
  activeCharacters: Character[];

  // Server-game derived state
  serverTotal: number | null;
  serverReadiness: GuessReadinessSnapshot | null;
  effectiveRemaining: number;
  confidence: number;

  // Global stats
  globalStats: GlobalStats | null;
  gameHistory: GameHistoryEntry[];
  gamesPlayed: number;
  statsLoading: boolean;

  // Session
  hasSavedSession: boolean;
  resumeSession: () => void;
  clearSession: () => void;

  // Transient UI state
  online: boolean;
  eliminatedCount: number | null;
  remainingHistoryRef: RefObject<number[]>;
  isNewPersonalBest: boolean;
  personalBest: number | null;
  dailyStreak: number;
  achievements: Achievement[];
  weeklyRecap: WeeklyRecap | null;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;

  // Handlers
  startGame: () => void | Promise<void>;
  handleAnswer: (value: AnswerValue) => void | Promise<void>;
  handleSkip: () => void;
  handleGiveUp: () => void;
  handleCorrectGuess: () => void;
  handleIncorrectGuess: () => void;
  handleRejectGuess: () => void;
  retryAfterReject: () => void;
  handleShare: () => void | Promise<void>;
  handleCopyLink: () => void | Promise<void>;
  handleReveal: (name: string) => Promise<RevealResult>;
  handleAddCharacter: (c: Character) => void;
  handleAddQuestions: (q: Question[]) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx)
    throw new Error(
      "useGameContext must be used within <GameContext.Provider>",
    );
  return ctx;
}
