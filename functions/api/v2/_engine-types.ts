// Server-side game engine types — extracted from _game-engine.ts (RF.2).
// Re-exported from _game-engine.ts for back-compat with existing import paths.

import type { GuessReadiness as BaseGuessReadiness, GameAnswer } from "@guess/game-engine";

// Re-export shared types so callers keep their import paths
export type {
  AnswerValue,
  GuessTrigger,
  MCTSOptions,
  QuestionSelectionOptions,
  ReasoningExplanation,
  ScoringOptions,
} from "@guess/game-engine";

export type Answer = GameAnswer;

export interface ServerCharacter {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  trivia?: string[];
  attributes: Record<string, boolean | null>;
}

export interface ServerQuestion {
  id: string;
  text: string;
  attribute: string;
  displayText?: string;
  category?: string;
}

export interface GuessAnalytics {
  confidence: number;
  entropy: number;
  remaining: number;
  answerDistribution: Record<string, number>;
  trigger?: string;
  forced?: boolean;
  gap?: number;
  aliveCount?: number;
  questionsRemaining?: number;
}

/** Server GuessReadiness extends the shared base with reject-cooldown fields.
 *  `evaluateGuessReadiness` always returns these as false/0; the route handler
 *  overrides them with actual session cooldown state before sending the response. */
export interface GuessReadiness extends BaseGuessReadiness {
  blockedByRejectCooldown: boolean;
  rejectCooldownRemaining: number;
}

export interface GameSession {
  id: string;
  characters: ServerCharacter[];
  questions: ServerQuestion[];
  /** Pre-computed at game start (immutable for pool lifetime). Avoids recomputation per answer. */
  coverageMap?: Map<string, number>;
  /** Popularity prior: character id → normalized [0,1] score. Decays with game progress. */
  popularityMap?: Map<string, number>;
  answers: Answer[];
  currentQuestion: ServerQuestion | null;
  difficulty: string;
  maxQuestions: number;
  createdAt: number;
  rejectedGuesses: string[];
  /** Question attribute keys the user has explicitly skipped (excluded from future selection). */
  skippedQuestions: string[];
  guessCount: number;
  postRejectCooldown: number;
  guessAnalytics?: GuessAnalytics;
  /** Detective persona derived from difficulty: sherlock | watson | poirot */
  persona?: string;
  /** A/B variant label stamped at session start. Persisted to game_stats on result. */
  variant?: "control" | "experiment";
  /** Question selector used by this session: 'greedy' (1-step) or 'mcts' (2-step). */
  selector?: "greedy" | "mcts";
  /** AN.11: top-candidate posterior probability after each answer (normalized [0,1]).
   *  Index i corresponds to session.answers[i]. Used to detect the "aha moment" jump. */
  posteriorHistory?: number[];
  /** AN.21: top-10 character candidates (id + name) after each answer.
   *  Index i corresponds to session.answers[i]. Used for catastrophic-failure triage. */
  stepTopTen?: Array<Array<{ id: string; name: string }>>;
  /** Owner userId — stamped on second storeSession call in start.ts once known.
   *  Absent on sessions created before this field was added (legacy). */
  userId?: string;
}

// ── Server-specific constants ─────────────────────────────────────────────────

export const POOL_SIZE = 500;
export const MIN_ATTRIBUTES = 20;
export const SESSION_TTL = 3600; // 1 hour

export const DIFFICULTY_MAP: Record<string, number> = {
  easy: 20,
  medium: 15,
  hard: 10,
};

export const VALID_ANSWERS = new Set<string>(["yes", "no", "maybe", "unknown"]);

/** Bonus questions granted per rejected guess. Hard cap at base × 2. */
export const BONUS_QUESTIONS_PER_REJECT: Record<string, number> = {
  easy: 3,
  medium: 2,
  hard: 2,
};
