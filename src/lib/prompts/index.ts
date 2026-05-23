/**
 * Barrel for prompt builders. Sub-modules:
 * - `./core` — shared utilities (sanitization, persona, version)
 * - `./gameplay` — runtime prompts during a game (dynamic, narrative, contradictions, etc.)
 * - `./teaching` — content authoring prompts (question generation, attribute fills, bios)
 * - `./admin` — database maintenance prompts (cleanup, correction judging)
 *
 * Callsites should keep importing from `@/lib/prompts` for stability.
 */
export type { PromptPair } from './core'
export {
  CLOSE_TO_GUESS_ASIDE,
  EARLY_CONFIDENCE_ASIDE,
  INJECTION_GUARD,
  PROMPT_VERSION,
  confidenceTierPhrase,
  getDifficultyPersona,
  reformulateForSelf,
  sanitizeForPrompt,
} from './core'
export {
  conversationalParse_v1,
  contradictionExplain_v1,
  contradictionPushback_v1,
  distinctiveAttributeExplain_v1,
  dynamicQuestion_v1,
  narrativeExplanation_v1,
  selfMatchNarrative_v1,
  suspectDescription_v1,
} from './gameplay'
export {
  attributeAutoFill_v1,
  attributeRecommendation_v1,
  categoryRecommendation_v1,
  livingBio_v1,
  questionGeneration_v1,
} from './teaching'
export { correctionJudge_v1, dataCleanup_v1 } from './admin'
