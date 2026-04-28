// ── @guess/game-engine ────────────────────────────────────────────────────────
// Shared Bayesian game engine: scoring, question selection, and guess readiness.
// Used by both the React client (src/lib/gameEngine.ts) and the Cloudflare
// Worker API (functions/api/v2/_game-engine.ts).

export * from './constants.js'
export * from './types.js'
export { calculateProbabilities, scoreForAnswer } from './scoring.js'
export { selectBestQuestion, getAttributeGroup, entropy } from './question-selection.js'
export { selectBestQuestionMCTS } from './question-selection-mcts.js'
export type { MCTSOptions } from './question-selection-mcts.js'
export {
  evaluateGuessReadiness,
  shouldMakeGuess,
  getBestGuess,
  generateReasoning,
  detectContradictions,
} from './guess-readiness.js'
export {
  AnswerValueSchema,
  PersonaSchema,
  GuessTriggerSchema,
  GameCharacterSchema,
  GameQuestionSchema,
  GameAnswerSchema,
} from './schemas.js'
