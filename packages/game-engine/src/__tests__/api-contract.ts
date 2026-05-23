/**
 * DX.32 — game-engine API contract assertions
 *
 * Type-level checks that the public exports of @guess/game-engine still exist
 * with the expected signatures. Any removed or renamed export fails tsc at
 * compile time — no snapshot maintenance required.
 *
 * This file is intentionally NOT a vitest test file (no `.test.ts` suffix) so
 * it runs only during `pnpm typecheck` / `tsc`, not during `pnpm test`.
 */

import {
  // ── Constants (runtime values) ─────────────────────────────────────────────
  SCORE_MATCH,
  SCORE_MISMATCH,
  SCORE_UNKNOWN,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
  MAYBE_ANSWER_PROB,
  ALIVE_THRESHOLD,
  MIN_INFO_GAIN,
  // ── Functions ─────────────────────────────────────────────────────────────
  calculateProbabilities,
  scoreForAnswer,
  selectBestQuestion,
  selectBestQuestionMCTS,
  getAttributeGroup,
  entropy,
  buildQualityPenaltyMap,
  computeQualityPenalty,
  evaluateGuessReadiness,
  shouldMakeGuess,
  getBestGuess,
  generateReasoning,
  detectContradictions,
  // ── Zod schemas ────────────────────────────────────────────────────────────
  AnswerValueSchema,
  PersonaSchema,
  GuessTriggerSchema,
  GameCharacterSchema,
  GameQuestionSchema,
  GameAnswerSchema,
} from '@guess/game-engine'

import type {
  // ── Types ──────────────────────────────────────────────────────────────────
  Persona,
  AnswerValue,
  GuessTrigger,
  GameCharacter,
  GameQuestion,
  GameAnswer,
  ScoringWeights,
  ScoringOptions,
  StructuralWeights,
  QuestionSelectionOptions,
  GuessReadiness,
  ReasoningExplanation,
  QualityPenaltyOptions,
  QualitySignals,
  MCTSOptions,
} from '@guess/game-engine'

// If any import above fails to resolve, tsc will error:
//   "Module '@guess/game-engine' has no exported member 'X'."
// This catches accidental renames and removals before they reach the client.

type _Assertions = {
  constants: [
    typeof SCORE_MATCH,
    typeof SCORE_MISMATCH,
    typeof SCORE_UNKNOWN,
    typeof SCORE_MAYBE,
    typeof SCORE_MAYBE_MISS,
    typeof MAYBE_ANSWER_PROB,
    typeof ALIVE_THRESHOLD,
    typeof MIN_INFO_GAIN,
  ]
  fns: [
    typeof calculateProbabilities,
    typeof scoreForAnswer,
    typeof selectBestQuestion,
    typeof selectBestQuestionMCTS,
    typeof getAttributeGroup,
    typeof entropy,
    typeof buildQualityPenaltyMap,
    typeof computeQualityPenalty,
    typeof evaluateGuessReadiness,
    typeof shouldMakeGuess,
    typeof getBestGuess,
    typeof generateReasoning,
    typeof detectContradictions,
  ]
  schemas: [
    typeof AnswerValueSchema,
    typeof PersonaSchema,
    typeof GuessTriggerSchema,
    typeof GameCharacterSchema,
    typeof GameQuestionSchema,
    typeof GameAnswerSchema,
  ]
  types: [
    Persona,
    AnswerValue,
    GuessTrigger,
    GameCharacter,
    GameQuestion,
    GameAnswer,
    ScoringWeights,
    ScoringOptions,
    StructuralWeights,
    QuestionSelectionOptions,
    GuessReadiness,
    ReasoningExplanation,
    QualityPenaltyOptions,
    QualitySignals,
    MCTSOptions,
  ]
}

export type { _Assertions }

