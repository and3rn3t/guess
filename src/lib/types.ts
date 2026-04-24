export type { Persona } from '@guess/game-engine'
import type { Persona } from '@guess/game-engine'

export type CharacterCategory =
  | "video-games"
  | "movies"
  | "anime"
  | "comics"
  | "books"
  | "cartoons"
  | "tv-shows"
  | "pop-culture";

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  maxQuestions: number;
  label: string;
  description: string;
}

/** Difficulty presets mapping difficulty keys to question limits and display metadata. */
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { maxQuestions: 20, label: "Easy", description: "20 questions, relaxed" },
  medium: { maxQuestions: 15, label: "Medium", description: "15 questions, balanced" },
  hard: { maxQuestions: 10, label: "Hard", description: "10 questions, challenging" },
};

/** Maps game difficulty to the corresponding detective persona. */
export const DIFFICULTY_TO_PERSONA: Record<Difficulty, Persona> = {
  easy: 'poirot',
  medium: 'watson',
  hard: 'sherlock',
};

/** Human-readable labels for each character category. */
export const CATEGORY_LABELS: Record<CharacterCategory, string> = {
  "video-games": "Video Games",
  movies: "Movies",
  anime: "Anime",
  comics: "Comics",
  books: "Books",
  cartoons: "Cartoons",
  "tv-shows": "TV Shows",
  "pop-culture": "Pop Culture",
};

export interface Character {
  id: string;
  name: string;
  category: CharacterCategory;
  attributes: Record<string, boolean | null>;
  imageUrl?: string;
  isCustom?: boolean;
  createdBy?: string;
  createdAt?: number;
}

export interface Question {
  id: string
  text: string
  attribute: string
  displayText?: string
  category?: string
}

export type AnswerValue = 'yes' | 'no' | 'maybe' | 'unknown'

export interface Answer {
  questionId: string
  value: AnswerValue
}

export interface GameState {
  currentQuestion: Question | null
  answers: Answer[]
  possibleCharacters: Character[]
  confidence: number
  questionCount: number
  isComplete: boolean
  finalGuess: Character | null
}

export interface ReasoningExplanation {
  why: string
  impact: string
  remaining: number
  confidence: number
  topCandidates?: Array<{ name: string; probability: number; imageUrl?: string | null }>
}

export type GuessReadinessTrigger =
  | 'singleton'
  | 'max_questions'
  | 'high_certainty'
  | 'strict_readiness'
  | 'insufficient_data'

export interface GuessReadinessSnapshot {
  trigger: GuessReadinessTrigger
  blockedByRejectCooldown: boolean
  rejectCooldownRemaining: number
  topProbability?: number
  gap?: number
  aliveCount?: number
  questionsRemaining?: number
  forced?: boolean
}

export interface GameHistoryEntry {
  id: string
  characterId: string
  characterName: string
  won: boolean
  timestamp: number
  difficulty: Difficulty
  totalQuestions: number
  steps: GameHistoryStep[]
}

export interface GameHistoryStep {
  questionId?: string
  questionText: string
  attribute: string
  answer: AnswerValue
}
