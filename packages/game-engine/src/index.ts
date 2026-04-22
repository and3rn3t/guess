// ── @guess/game-engine ────────────────────────────────────────────────────────
// Shared Bayesian game engine: scoring, question selection, and guess readiness.
// Used by both the React client (src/lib/gameEngine.ts) and the Cloudflare
// Worker API (functions/api/v2/_game-engine.ts).

export * from './constants.js'
export * from './types.js'
export { calculateProbabilities, scoreForAnswer } from './scoring.js'
export { selectBestQuestion, getAttributeGroup, entropy } from './question-selection.js'
export {
  evaluateGuessReadiness,
  shouldMakeGuess,
  getBestGuess,
  generateReasoning,
  detectContradictions,
} from './guess-readiness.js'
