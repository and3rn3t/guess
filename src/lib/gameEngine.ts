// Client-side game engine wrapper.
// All core Bayesian logic lives in @guess/game-engine.
// This module re-exports everything under the app's own Character/Question/Answer types,
// ensuring callers never need to import from two places.

import type {
  ScoringOptions,
  QuestionSelectionOptions,
  ReasoningExplanation as SharedReasoningExplanation,
} from '@guess/game-engine'
import {
  calculateProbabilities as _calculateProbabilities,
  selectBestQuestion as _selectBestQuestion,
  generateReasoning as _generateReasoning,
  shouldMakeGuess as _shouldMakeGuess,
  evaluateGuessReadiness as _evaluateGuessReadiness,
  getBestGuess as _getBestGuess,
  detectContradictions as _detectContradictions,
} from '@guess/game-engine'
import type { Character, Question, Answer, ReasoningExplanation } from './types'

// Re-export shared types so callers only need one import
export type {
  ScoringOptions,
  QuestionSelectionOptions,
  GuessTrigger,
  GuessReadiness,
} from '@guess/game-engine'

// ── Typed wrapper functions ───────────────────────────────────────────────────
// Each function delegates to the shared engine. Parameter types use the app's
// richer Character/Question/Answer types (structural subtypes of the shared
// GameCharacter/GameQuestion/GameAnswer interfaces).

/** Compute Bayesian-style posterior probability for each character. */
export function calculateProbabilities(
  characters: Character[],
  answers: Answer[],
  options?: ScoringOptions
): Map<string, number> {
  return _calculateProbabilities(characters, answers, options)
}

/** Pick the next question with the highest expected information gain. */
export function selectBestQuestion(
  characters: Character[],
  answers: Answer[],
  allQuestions: Question[],
  options?: QuestionSelectionOptions
): Question | null {
  // Cast is safe: the impl returns one of the elements from allQuestions
  return _selectBestQuestion(characters, answers, allQuestions, options) as Question | null
}

/** Build a human-readable explanation of why a question was chosen. */
export function generateReasoning(
  question: Question,
  characters: Character[],
  answers: Answer[]
): ReasoningExplanation {
  // SharedReasoningExplanation.topCandidates is required; client ReasoningExplanation has it optional — compatible
  return _generateReasoning(question, characters, answers) as SharedReasoningExplanation & ReasoningExplanation
}

/** Decide whether confidence is high enough to guess (thin wrapper). */
export function shouldMakeGuess(
  characters: Character[],
  answers: Answer[],
  questionCount: number,
  maxQuestions = 15,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions
): boolean {
  return _shouldMakeGuess(characters, answers, questionCount, maxQuestions, priorWrongGuesses, scoring)
}

/** Evaluate guess readiness and return full diagnostic metrics. */
export function evaluateGuessReadiness(
  characters: Character[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions,
  preComputedProbs?: Map<string, number>
) {
  return _evaluateGuessReadiness(characters, answers, questionCount, maxQuestions, priorWrongGuesses, scoring, preComputedProbs)
}

/** Return the character with the highest posterior probability. */
export function getBestGuess(characters: Character[], answers: Answer[]): Character | null {
  // Cast is safe: the impl finds and returns an element from characters
  return _getBestGuess(characters, answers) as Character | null
}

/** Check whether the current answers have eliminated all characters. */
export function detectContradictions(
  allCharacters: Character[],
  answers: Answer[]
): { hasContradiction: boolean; remainingCount: number } {
  return _detectContradictions(allCharacters, answers)
}
