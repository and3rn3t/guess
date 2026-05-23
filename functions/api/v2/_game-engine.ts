// Server-side game engine.
// Core Bayesian logic: @guess/game-engine (shared package).
// This module provides server-specific typed wrappers + utilities, and
// re-exports types/constants/session-store/adaptive/questions-cache helpers
// for back-compat with existing import paths.

import {
  calculateProbabilities as _calculateProbabilities,
  evaluateGuessReadiness as _evaluateGuessReadiness,
  generateReasoning as _generateReasoning,
  selectBestQuestion as _selectBestQuestion,
  selectBestQuestionMCTS as _selectBestQuestionMCTS,
  shouldMakeGuess as _shouldMakeGuess,
} from "@guess/game-engine";
import type {
  MCTSOptions,
  ScoringOptions,
} from "@guess/game-engine";

import type {
  Answer,
  GameSession,
  GuessReadiness,
  ServerCharacter,
  ServerQuestion,
} from "./_engine-types";
import type { AdaptiveData } from "./_adaptive";

// ── Back-compat re-exports ───────────────────────────────────────────────────
// Types
export type {
  AnswerValue,
  GuessTrigger,
  MCTSOptions,
  QuestionSelectionOptions,
  ReasoningExplanation,
  ScoringOptions,
} from "@guess/game-engine";
export type {
  Answer,
  GameSession,
  GuessAnalytics,
  GuessReadiness,
  ServerCharacter,
  ServerQuestion,
} from "./_engine-types";
// Constants
export {
  BONUS_QUESTIONS_PER_REJECT,
  DIFFICULTY_MAP,
  MIN_ATTRIBUTES,
  POOL_SIZE,
  SESSION_TTL,
  VALID_ANSWERS,
} from "./_engine-types";
// Adaptive data
export type { AdaptiveData } from "./_adaptive";
export { loadAdaptiveData } from "./_adaptive";
// Session storage
export {
  deleteSession,
  loadSession,
  saveSessionState,
  storeSession,
  verifySessionOwner,
} from "./_session-store";
// Questions cache
export { loadCachedQuestions, storeCachedQuestions } from "./_questions-cache";

// ── Typed wrapper functions ──────────────────────────────────────────────────
// Each function delegates to the shared engine with ServerCharacter/ServerQuestion
// typed inputs and outputs (structural subtypes of the shared GameCharacter/GameQuestion).

/** Compute Bayesian-style posterior probability for each character. */
export function calculateProbabilities(
  characters: ServerCharacter[],
  answers: Answer[],
  options?: ScoringOptions,
): Map<string, number> {
  return _calculateProbabilities(characters, answers, options);
}

/** Pick the next question. Selector defaults to 'mcts' (2-step look-ahead);
 *  pass 'greedy' for the 1-step info-gain selector — used by the A/B control arm. */
export function selectBestQuestion(
  characters: ServerCharacter[],
  answers: Answer[],
  allQuestions: ServerQuestion[],
  options?: MCTSOptions,
  selector: "greedy" | "mcts" = "mcts",
): ServerQuestion | null {
  // Cast is safe: the impl returns one of the elements from allQuestions
  const impl =
    selector === "greedy" ? _selectBestQuestion : _selectBestQuestionMCTS;
  return impl(
    characters,
    answers,
    allQuestions,
    options,
  ) as ServerQuestion | null;
}

/** Build a human-readable explanation of why a question was chosen. */
export function generateReasoning(
  question: ServerQuestion,
  characters: ServerCharacter[],
  answers: Answer[],
  scoring?: ScoringOptions,
) {
  return _generateReasoning(question, characters, answers, scoring);
}

/** Decide whether confidence is high enough to guess (thin wrapper). */
export function shouldMakeGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions,
): boolean {
  return _shouldMakeGuess(
    characters,
    answers,
    questionCount,
    maxQuestions,
    priorWrongGuesses,
    scoring,
  );
}

/** Evaluate guess readiness and return full diagnostic metrics.
 *  Returns `blockedByRejectCooldown: false` / `rejectCooldownRemaining: 0`;
 *  the calling route handler spreads the actual cooldown values over these defaults. */
export function evaluateGuessReadiness(
  characters: ServerCharacter[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions,
  preComputedProbs?: Map<string, number>,
): GuessReadiness {
  return {
    ..._evaluateGuessReadiness(
      characters,
      answers,
      questionCount,
      maxQuestions,
      priorWrongGuesses,
      scoring,
      preComputedProbs,
    ),
    blockedByRejectCooldown: false,
    rejectCooldownRemaining: 0,
  };
}

/** Return the best guess character, excluding previously rejected guesses. */
export function getBestGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = [],
  scoring?: ScoringOptions,
): ServerCharacter | null {
  return getBestGuessResult(characters, answers, rejectedGuesses, scoring)
    .character;
}

/** Like getBestGuess but also returns the probability map, avoiding a redundant
 *  calculateProbabilities call in the caller when confidence/entropy are needed. */
export function getBestGuessResult(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = [],
  scoring?: ScoringOptions,
): { character: ServerCharacter | null; probs: Map<string, number> } {
  if (characters.length === 0) return { character: null, probs: new Map() };

  const rejectedSet = new Set(rejectedGuesses);
  const eligible = characters.filter((c) => !rejectedSet.has(c.id));
  if (eligible.length === 0) return { character: null, probs: new Map() };

  const probs = _calculateProbabilities(eligible, answers, scoring);
  const sorted = Array.from(probs.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const bestId = sorted[0][0];
  const character = eligible.find((c) => c.id === bestId) ?? eligible[0];
  return { character, probs };
}

/** Check for contradictions (all characters eliminated). */
export function detectContradictions(
  characters: ServerCharacter[],
  answers: Answer[],
): { hasContradiction: boolean; remainingCount: number } {
  if (answers.length === 0)
    return { hasContradiction: false, remainingCount: characters.length };
  // Delegates to filterPossibleCharacters for consistency with the game loop
  const remaining = filterPossibleCharacters(characters, answers).length;
  return { hasContradiction: remaining === 0, remainingCount: remaining };
}

/** Hard-filter characters based on definitive answers and rejected guesses.
 *  Allows up to MAX_MISMATCHES contradictions to tolerate bad attribute data
 *  or occasional user errors (e.g. enrichment error + one mis-tap). */
const MAX_MISMATCHES = 2;

export function filterPossibleCharacters(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = [],
): ServerCharacter[] {
  const rejectedSet = new Set(rejectedGuesses);
  return characters.filter((char) => {
    if (rejectedSet.has(char.id)) return false;
    let mismatches = 0;
    for (const answer of answers) {
      const attr = char.attributes[answer.questionId];
      if (answer.value === "yes" && attr === false) mismatches++;
      else if (answer.value === "no" && attr === true) mismatches++;
      if (mismatches > MAX_MISMATCHES) return false;
    }
    return true;
  });
}

// ── Server utilities ──────────────────────────────────────────────────────────

/** Parse the denormalized attributes_json column into a typed attribute map.
 *  Shared by game/start.ts and game/resume.ts. */
export function parseAttrsJson(json: string): Record<string, boolean | null> {
  try {
    const raw = JSON.parse(json) as Record<string, number>;
    const result: Record<string, boolean | null> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (val === 1) {
        result[key] = true;
      } else if (val === 0) {
        result[key] = false;
      } else {
        result[key] = null;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Return the session's pre-computed coverage map, or build it on-the-fly for
 *  sessions created before the coverage map optimization. */
export function getOrBuildCoverageMap(
  session: GameSession,
): Map<string, number> {
  if (session.coverageMap) return session.coverageMap;
  const coverageMap = new Map<string, number>();
  const charCount = session.characters.length;
  for (const q of session.questions) {
    const known = session.characters.filter(
      (c) => c.attributes[q.attribute] != null,
    ).length;
    coverageMap.set(q.attribute, known / charCount);
  }
  return coverageMap;
}

/** Build the MCTSOptions object for selectBestQuestion from session context + adaptive data.
 *  Pass extras for per-turn values (progress, pre-computed probs, recent question categories). */
export function buildQuestionOptions(
  session: GameSession,
  scoring: ScoringOptions,
  adaptive: AdaptiveData,
  extras?: {
    progress?: number;
    probs?: Map<string, number>;
    recentCategories?: string[];
  },
): MCTSOptions {
  return {
    progress: extras?.progress,
    recentCategories: extras?.recentCategories,
    scoring: {
      ...scoring,
      disputeMap: adaptive.disputeMap,
      attributeTrustMap: adaptive.attributeTrustMap,
      characterPopularityMap: adaptive.characterPopularityMap,
      // Active weights override caller-supplied weights only when the
      // kill switch is on and the blob passed validation in loadAdaptiveData.
      weights: adaptive.activeWeights ?? scoring.weights,
    },
    probs: extras?.probs,
    mctsEndgameThreshold: session.difficulty === "hard" ? 0.7 : undefined,
    gameDifficulty: session.difficulty as "easy" | "medium" | "hard",
    maybeRateMap: adaptive.maybeRateMap,
    netGainMap: adaptive.netGainMap,
    confusionDiscriminators: adaptive.confusionDiscriminators,
    questionEmpiricalGainMap: adaptive.questionEmpiricalGainMap,
    questionQualityPenaltyMap: adaptive.questionQualityPenaltyMap,
    confusionPairs: adaptive.confusionPairs,
  };
}
