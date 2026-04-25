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
  /**
   * Per-character per-attribute dispute confidence (0–1). When a character-attribute
   * pair has confidence < 1, the scoring for that pair is blended toward the neutral
   * effectiveUnknown score, reducing certainty from contested attribute values.
   * Populated at runtime from the `attribute_disputes` D1 table (status = 'open').
   */
  disputeMap?: Record<string, Record<string, number>>
}

/**
 * Injectable overrides for structural multipliers used by question selection.
 * Allows grid search and A-B testing to tune diversity/taxonomy/endgame constants
 * without touching production code.
 */
export interface StructuralWeights {
  /** Multiplier applied when a question's attribute-group matches a recent answer. Default: 0.75. */
  diversityGroupPenalty?: number
  /** Multiplier applied when a question's category matches a recent answer. Default: 0.8. */
  diversityCategoryPenalty?: number
  /** Early-game info-gain boost for species-type questions (human/robot/alien…). Default: 2.0. */
  taxonomySpeciesBoost?: number
  /** Early-game info-gain boost for origin/medium/genre questions. Default: 1.3. */
  taxonomyOriginBoost?: number
  /** Progress threshold at which endgame focus mode activates. Default: 0.65. */
  endgameFocusThreshold?: number
  /** Number of recent answers checked for attribute-group diversity. Default: 5. */
  diversityWindow?: number
  /**
   * Net-gain floor below which questions are dropped from the scoring pool when
   * higher-gain alternatives exist. Keyed on attribute names from `netGainMap`.
   * Default: NET_GAIN_FLOOR (0.05).
   */
  netGainFloor?: number
}

export interface QuestionSelectionOptions {
  progress?: number
  recentCategories?: string[]
  scoring?: ScoringOptions
  /** Pre-computed probabilities — avoids a redundant calculateProbabilities call in callers. */
  probs?: Map<string, number>
  /** Injectable structural multipliers for diversity, taxonomy, and endgame behaviour. */
  structuralWeights?: StructuralWeights
  /**
   * Per-attribute maybe-answer probability (0–1). Replaces the global MAYBE_ANSWER_PROB
   * constant in the three-way entropy calculation. Derived from real game stats via
   * `scripts/simulate/export-maybe-rates.ts` and stored in KV as `kv:attribute-maybe-rates`.
   */
  maybeRateMap?: Record<string, number>
  /**
   * Per-attribute net information gain (0–1, normalized). Questions below `netGainFloor`
   * are filtered from the scoring pool when better alternatives exist.
   * Derived from simulation data via `scripts/simulate/export-net-gains.ts`.
   */
  netGainMap?: Record<string, number>
  /**
   * Per-character list of attribute keys that best discriminate it from its most
   * frequent confusers (characters often confused with it at guess time).
   * In endgame, questions matching these attributes receive a ×1.4 boost.
   * Derived from simulation data via `scripts/simulate/confusion-pairs.ts`.
   */
  confusionDiscriminators?: Record<string, string[]>
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
