/**
 * Headless game simulation engine.
 *
 * Drives the same Bayesian game loop used by the Cloudflare Worker but entirely
 * in-process — no network, no KV, no D1. The oracle player reads the target
 * character's known attributes and answers deterministically.
 *
 * Null attributes → 'unknown' (reflects real data gaps; keeps simulation deterministic).
 */

import type {
  AnswerValue,
  GameAnswer,
  GuessTrigger,
  ScoringOptions,
  StructuralWeights,
} from "@guess/game-engine";
import {
  calculateProbabilities,
  entropy,
  evaluateGuessReadiness,
  selectBestQuestionMCTS,
} from "@guess/game-engine";

// ── Local types ────────────────────────────────────────────────────────────────

export interface SimCharacter {
  id: string;
  name: string;
  popularity: number;
  category?: string;
  attributes: Record<string, boolean | null>;
}

export interface SimQuestion {
  id: string;
  text: string;
  attribute: string;
  category?: string;
}

export interface SimQuestionStep {
  attribute: string;
  answer: AnswerValue;
  /** Entropy reduction from this question: H(before) - H(after). */
  infoGain: number;
}

export interface SimGameResult {
  runId: string;
  targetCharacterId: string;
  targetCharacterName: string;
  targetCharacterCategory: string | null;
  won: boolean;
  questionsAsked: number;
  guessesUsed: number;
  guessTrigger: GuessTrigger | null;
  forcedGuess: boolean;
  confidenceAtGuess: number | null;
  entropyAtGuess: number | null;
  gapAtGuess: number | null;
  aliveCountAtGuess: number | null;
  secondBestCharacterId: string | null;
  secondBestCharacterName: string | null;
  secondBestProbability: number | null;
  questionsSequence: SimQuestionStep[];
  answerDistribution: Record<AnswerValue, number>;
  characterPoolSize: number;
  maxQuestions: number;
  difficulty: string;
  /** Noise fraction applied to the oracle (0 = deterministic, 0.1 = 10% random flips). */
  noise: number;
  createdAt: number;
}

// ── Difficulty settings (mirrors _game-engine.ts) ─────────────────────────────

export const DIFFICULTY_MAP: Record<string, number> = {
  easy: 20,
  medium: 15,
  hard: 10,
};

export const BONUS_QUESTIONS_PER_REJECT: Record<string, number> = {
  easy: 3,
  medium: 2,
  hard: 2,
};

/** Characters with mismatch count above this threshold are filtered out (mirrors MAX_MISMATCHES). */
const MAX_MISMATCHES = 2;

// ── Oracle player ─────────────────────────────────────────────────────────────

/**
 * Answer a question about the target character deterministically.
 * true → 'yes', false → 'no', null → 'unknown' (data gap).
 */
function oracleAnswer(target: SimCharacter, attribute: string): AnswerValue {
  const val = target.attributes[attribute];
  if (val === true) return "yes";
  if (val === false) return "no";
  return "unknown";
}

/**
 * Noisy oracle: with probability `noise`, randomly flip the answer to simulate
 * a real player's uncertainty. null attributes are never flipped (oracle can't
 * know what it doesn't know). Flips: true→maybe, false→unknown.
 */
function noisyOracleAnswer(
  target: SimCharacter,
  attribute: string,
  noise: number,
): AnswerValue {
  const clean = oracleAnswer(target, attribute);
  if (noise <= 0 || clean === "unknown") return clean;
  if (Math.random() < noise) {
    // Flip true→maybe, false→unknown (asymmetric — mirrors real player ambiguity)
    return clean === "yes" ? "maybe" : "unknown";
  }
  return clean;
}

// ── Pool filtering (mirrors filterPossibleCharacters in _game-engine.ts) ──────

function filterPool(
  characters: SimCharacter[],
  answers: GameAnswer[],
  rejectedIds: Set<string>,
): SimCharacter[] {
  return characters.filter((char) => {
    if (rejectedIds.has(char.id)) return false;
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

// ── Best guess (mirrors getBestGuessResult in _game-engine.ts) ────────────────

function getBestGuess(
  characters: SimCharacter[],
  answers: GameAnswer[],
  rejectedIds: Set<string>,
  scoring: ScoringOptions,
): {
  character: SimCharacter | null;
  probs: Map<string, number>;
  secondBest: SimCharacter | null;
} {
  const eligible = characters.filter((c) => !rejectedIds.has(c.id));
  if (eligible.length === 0)
    return { character: null, probs: new Map(), secondBest: null };

  const probs = calculateProbabilities(eligible, answers, scoring);
  const sorted = Array.from(probs.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const bestId = sorted[0]?.[0] ?? null;
  const secondId = sorted[1]?.[0] ?? null;
  const character = bestId
    ? (eligible.find((c) => c.id === bestId) ?? null)
    : null;
  const secondBest = secondId
    ? (eligible.find((c) => c.id === secondId) ?? null)
    : null;
  return { character, probs, secondBest };
}

// ── Coverage + popularity maps (mirrors start.ts logic) ───────────────────────

function buildScoringMaps(
  pool: SimCharacter[],
  questions: SimQuestion[],
  weights?: ScoringWeights,
): ScoringOptions {
  const coverageMap = new Map<string, number>();
  for (const q of questions) {
    const known = pool.filter((c) => c.attributes[q.attribute] != null).length;
    coverageMap.set(q.attribute, known / pool.length);
  }

  const maxPop = Math.max(...pool.map((c) => c.popularity), 1);
  const popularityMap = new Map(pool.map((c) => [c.id, c.popularity / maxPop]));

  return { coverageMap, popularityMap, weights };
}

// ── Core simulation loop ──────────────────────────────────────────────────────

export interface SimulateOptions {
  difficulty?: string;
  /** Cap pool size. Defaults to the full pool passed in. */
  poolSize?: number;
  /**
   * Noise fraction [0, 1]. At each oracle answer, flip with this probability:
   * yes→maybe, no→unknown. Simulates real-player imprecision.
   * Default: 0 (deterministic).
   */
  noise?: number;
  /**
   * Override Bayesian scoring multipliers. Used by grid search (S.8) to test
   * alternative weight combinations without touching production constants.
   */
  scoringWeights?: ScoringWeights;
  /**
   * Override structural question-selection constants. Used by grid search (Phase 2)
   * to tune diversity penalties, taxonomy boosts, and endgame thresholds.
   */
  structuralWeights?: StructuralWeights;
}

export function simulateGame(
  target: SimCharacter,
  pool: SimCharacter[],
  questions: SimQuestion[],
  runId: string,
  options: SimulateOptions = {},
): SimGameResult {
  const difficulty = options.difficulty ?? "medium";
  const noise = Math.max(0, Math.min(1, options.noise ?? 0));
  let maxQuestions = DIFFICULTY_MAP[difficulty] ?? 15;
  const bonusPerReject = BONUS_QUESTIONS_PER_REJECT[difficulty] ?? 2;

  // Use a capped pool size if requested; ensure target is always present
  let workingPool =
    options.poolSize && options.poolSize < pool.length
      ? (() => {
          const without = pool.filter((c) => c.id !== target.id);
          const shuffled = without.slice().sort(() => Math.random() - 0.5);
          return [target, ...shuffled.slice(0, options.poolSize - 1)];
        })()
      : pool.slice();

  // Always include the target in the pool
  if (!workingPool.some((c) => c.id === target.id)) {
    workingPool = [target, ...workingPool.slice(0, workingPool.length - 1)];
  }

  const scoring = buildScoringMaps(workingPool, questions, options.scoringWeights);

  const answers: GameAnswer[] = [];
  const rejectedIds = new Set<string>();
  const questionsSequence: SimQuestionStep[] = [];
  const answerDistribution: Record<AnswerValue, number> = {
    yes: 0,
    no: 0,
    maybe: 0,
    unknown: 0,
  };

  let guessesUsed = 0;
  let postRejectCooldown = 0;
  const hardCapMaxQuestions = maxQuestions + 10; // mirrors reject-guess.ts cap
  let won = false;
  let guessTrigger: GuessTrigger | null = null;
  let forcedGuess = false;
  let confidenceAtGuess: number | null = null;
  let entropyAtGuess: number | null = null;
  let gapAtGuess: number | null = null;
  let aliveCountAtGuess: number | null = null;
  let secondBestCharacterId: string | null = null;
  let secondBestCharacterName: string | null = null;
  let secondBestProbability: number | null = null;

  let filtered = filterPool(workingPool, answers, rejectedIds);
  let recentCategories: string[] = [];

  // Pre-compute probs for initial state
  let probs = calculateProbabilities(filtered, answers, scoring);

  while (true) {
    const questionCount = answers.length;
    const progress = questionCount / maxQuestions;

    // Check readiness before selecting next question
    const readiness = evaluateGuessReadiness(
      filtered,
      answers,
      questionCount,
      maxQuestions,
      guessesUsed,
      scoring,
      probs,
    );

    const blockedByCooldown = postRejectCooldown > 0 && !readiness.forced;
    if (blockedByCooldown) {
      postRejectCooldown = Math.max(0, postRejectCooldown - 1);
    }

    if (readiness.shouldGuess && !blockedByCooldown) {
      // Capture guess-time analytics
      const {
        character: guess,
        probs: guessProbs,
        secondBest,
      } = getBestGuess(filtered, answers, rejectedIds, scoring);

      if (!guess) break; // no eligible characters — treat as loss

      guessesUsed += 1;
      guessTrigger = readiness.trigger;
      forcedGuess = readiness.forced;
      confidenceAtGuess = guessProbs.get(guess.id) ?? null;
      entropyAtGuess = (() => {
        const vals = Array.from(guessProbs.values()).filter((p) => p > 0);
        return entropy(vals);
      })();
      gapAtGuess = readiness.gap;
      aliveCountAtGuess = readiness.aliveCount;
      secondBestCharacterId = secondBest?.id ?? null;
      secondBestCharacterName = secondBest?.name ?? null;
      secondBestProbability = secondBest
        ? (guessProbs.get(secondBest.id) ?? null)
        : null;

      if (guess.id === target.id) {
        won = true;
        break;
      }

      // Wrong guess — simulate rejection and continue with bonus questions
      rejectedIds.add(guess.id);
      // Mirror reject-guess.ts: effectiveBonus halved when < 10 chars remain; cap at base+10
      const effectiveBonus =
        filtered.length < 10
          ? Math.max(1, Math.floor(bonusPerReject / 2))
          : bonusPerReject;
      const prevMaxQ = maxQuestions;
      maxQuestions = Math.min(
        maxQuestions + effectiveBonus,
        hardCapMaxQuestions,
      );

      // If the budget is already capped and this was a forced guess, the game is exhausted.
      // Break to avoid an infinite loop (forced wrong guesses bypass postRejectCooldown,
      // so without this guard the loop never exits once questionCount >= hardCapMaxQuestions).
      if (readiness.forced && maxQuestions === prevMaxQ) break;

      postRejectCooldown = 1;

      // Re-filter without rejected character
      filtered = filterPool(workingPool, answers, rejectedIds);
      probs = calculateProbabilities(filtered, answers, scoring);
      continue;
    }

    // Select next question (2-step MCTS for mid-game; falls back to greedy near endgame)
    const nextQuestion = selectBestQuestionMCTS(filtered, answers, questions, {
      progress,
      recentCategories,
      scoring,
      probs,
      // Hard mode has 10q max: lower the MCTS→greedy handoff threshold so the greedy
      // top-two-split endgame logic activates at Q7 (70%) instead of Q9 (85%).
      mctsEndgameThreshold: difficulty === 'hard' ? 0.70 : undefined,
      structuralWeights: options.structuralWeights,
    });

    if (!nextQuestion) {
      // No questions left — force guess
      const {
        character: guess,
        probs: guessProbs,
        secondBest,
      } = getBestGuess(filtered, answers, rejectedIds, scoring);
      if (guess) {
        guessesUsed += 1;
        guessTrigger = "max_questions";
        forcedGuess = true;
        confidenceAtGuess = guessProbs.get(guess.id) ?? null;
        entropyAtGuess = entropy(
          Array.from(guessProbs.values()).filter((p) => p > 0),
        );
        gapAtGuess = null;
        aliveCountAtGuess = filtered.length;
        secondBestCharacterId = secondBest?.id ?? null;
        secondBestCharacterName = secondBest?.name ?? null;
        secondBestProbability = secondBest
          ? (guessProbs.get(secondBest.id) ?? null)
          : null;
        won = guess.id === target.id;
      }
      break;
    }

    // Compute entropy before the answer to calculate info gain
    const entropyBefore = entropy(
      Array.from(probs.values()).filter((p) => p > 0),
    );

    // Oracle player answers (deterministic or noisy)
    const answerValue = noise > 0
      ? noisyOracleAnswer(target, nextQuestion.attribute, noise)
      : oracleAnswer(target, nextQuestion.attribute);
    const answer: GameAnswer = {
      questionId: nextQuestion.attribute,
      value: answerValue,
    };
    answers.push(answer);
    answerDistribution[answerValue] += 1;

    // Update recent categories for diversity penalty
    if (nextQuestion.category) {
      recentCategories = [...recentCategories.slice(-2), nextQuestion.category];
    }

    // Update filtered pool and recompute probs
    filtered = filterPool(workingPool, answers, rejectedIds);
    probs = calculateProbabilities(filtered, answers, {
      ...scoring,
      progress: answers.length / maxQuestions,
    });

    // Entropy after answer for info gain
    const entropyAfter = entropy(
      Array.from(probs.values()).filter((p) => p > 0),
    );
    const infoGain = entropyBefore - entropyAfter;

    questionsSequence.push({
      attribute: nextQuestion.attribute,
      answer: answerValue,
      infoGain,
    });
  }

  return {
    runId,
    targetCharacterId: target.id,
    targetCharacterName: target.name,
    targetCharacterCategory: target.category ?? null,
    won,
    questionsAsked: answers.length,
    guessesUsed,
    guessTrigger,
    forcedGuess,
    confidenceAtGuess,
    entropyAtGuess,
    gapAtGuess,
    aliveCountAtGuess,
    secondBestCharacterId,
    secondBestCharacterName,
    secondBestProbability,
    questionsSequence,
    answerDistribution,
    characterPoolSize: workingPool.length,
    maxQuestions: DIFFICULTY_MAP[difficulty] ?? 15, // record base budget, not post-reject
    difficulty,
    noise,
    createdAt: Date.now(),
  };
}
