export type CharacterCategory =
  | "video-games"
  | "movies"
  | "anime"
  | "comics"
  | "books"
  | "cartoons";

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  maxQuestions: number;
  label: string;
  description: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { maxQuestions: 20, label: "Easy", description: "20 questions, relaxed" },
  medium: { maxQuestions: 15, label: "Medium", description: "15 questions, balanced" },
  hard: { maxQuestions: 10, label: "Hard", description: "10 questions, challenging" },
};

export const CATEGORY_LABELS: Record<CharacterCategory, string> = {
  "video-games": "Video Games",
  movies: "Movies",
  anime: "Anime",
  comics: "Comics",
  books: "Books",
  cartoons: "Cartoons",
};

export interface Character {
  id: string;
  name: string;
  category: CharacterCategory;
  attributes: Record<string, boolean | null>;
}

export interface Question {
  id: string
  text: string
  attribute: string
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
}
