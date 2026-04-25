// ── Detective persona ─────────────────────────────────────────────────────────
/**
 * Controls the AI's voice and phrasing across all prompts.
 * Maps 1:1 to difficulty: sherlock = hard, watson = medium, poirot = easy.
 */
export type Persona = 'sherlock' | 'watson' | 'poirot'

// ── Primitive answer type ─────────────────────────────────────────────────────
export type AnswerValue = 'yes' | 'no' | 'maybe' | 'unknown'

// ── Guess-readiness trigger ───────────────────────────────────────────────────
export type GuessTrigger =
  | 'singleton'
  | 'max_questions'
  | 'high_certainty'
  | 'strict_readiness'
  | 'time_pressure'
  | 'insufficient_data'

// ── Minimal interfaces the engine needs ──────────────────────────────────────
/**
 * The minimal character shape the engine operates on.
 * Both the client `Character` and server `ServerCharacter` are structurally
 * compatible with this interface.
 */
export interface GameCharacter {
  id: string
  name: string
  attributes: Record<string, boolean | null>
  /** Optional — used by generateReasoning to include images in candidate lists. */
  imageUrl?: string | null
}

/** The minimal question shape the engine operates on. */
export interface GameQuestion {
  attribute: string
  category?: string
}

export interface GameAnswer {
  questionId: string
  value: AnswerValue
}

// ── Scoring / selection options ───────────────────────────────────────────────

/**
 * Optional overrides for the Bayesian scoring multipliers.
 * When omitted, `scoring.ts` uses the module-level constants from `constants.ts`.
 * Used by the simulator grid search to test alternative weight combinations.
 */
export interface ScoringWeights {
  /** Perfect attribute match multiplier (default: SCORE_MATCH = 1.0). */
  match?: number
  /** Contradicting answer multiplier (default: SCORE_MISMATCH = 0.03). */
  mismatch?: number
  /** "Maybe" answer — attribute matches (default: SCORE_MAYBE = 0.7). */
  maybe?: number
  /** "Maybe" answer — attribute doesn't match (default: SCORE_MAYBE_MISS = 0.3). */
  maybeMiss?: number
}

export interface ScoringOptions {
  coverageMap?: Map<string, number>
  popularityMap?: Map<string, number>
  /** Game progress (0–1). Decays the popularity prior: full weight at 0, neutral at 1. */
  progress?: number
  /** Optional scoring weight overrides for grid search / A-B testing. */
  weights?: ScoringWeights
}

export interface QuestionSelectionOptions {
  progress?: number
  recentCategories?: string[]
  scoring?: ScoringOptions
  /** Pre-computed probabilities — avoids a redundant calculateProbabilities call in callers. */
  probs?: Map<string, number>
}

// ── Guess-readiness result ────────────────────────────────────────────────────
export interface GuessReadiness {
  shouldGuess: boolean
  forced: boolean
  trigger: GuessTrigger
  topProbability: number
  secondProbability: number
  gap: number
  entropy: number
  aliveCount: number
  questionsRemaining: number
  requiredConfidence: number
  requiredGap: number
  requiredEntropy: number
}

// ── Reasoning explanation ─────────────────────────────────────────────────────
export interface ReasoningExplanation {
  why: string
  impact: string
  remaining: number
  confidence: number
  topCandidates: Array<{ name: string; probability: number; imageUrl?: string | null }>
}
