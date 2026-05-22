// Server-side game engine.
// Core Bayesian logic: @guess/game-engine (shared package).
// This module adds server-specific types, session management, and typed wrappers.

import type {
  GuessReadiness as BaseGuessReadiness,
  GameAnswer,
} from "@guess/game-engine";
import {
  calculateProbabilities as _calculateProbabilities,
  evaluateGuessReadiness as _evaluateGuessReadiness,
  generateReasoning as _generateReasoning,
  selectBestQuestion as _selectBestQuestion,
  selectBestQuestionMCTS as _selectBestQuestionMCTS,
  shouldMakeGuess as _shouldMakeGuess,
} from "@guess/game-engine";
import {
  d1CacheGet,
  d1CachePut,
  d1ConfigGet,
  d1ConfigGetJson,
} from "../_d1_cache";

// Re-export shared types so existing callers keep their import paths
export type {
  AnswerValue,
  GuessTrigger,
  MCTSOptions,
  QuestionSelectionOptions,
  ReasoningExplanation,
  ScoringOptions,
} from "@guess/game-engine";

import type {
  MCTSOptions,
  ScoringOptions,
  ScoringWeights,
} from "@guess/game-engine";
export type Answer = GameAnswer;

// ── Server-specific types ─────────────────────────────────────────────────────

export interface ServerCharacter {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  trivia?: string[];
  attributes: Record<string, boolean | null>;
}

export interface ServerQuestion {
  id: string;
  text: string;
  attribute: string;
  displayText?: string;
  category?: string;
}

export interface GuessAnalytics {
  confidence: number;
  entropy: number;
  remaining: number;
  answerDistribution: Record<string, number>;
  trigger?: string;
  forced?: boolean;
  gap?: number;
  aliveCount?: number;
  questionsRemaining?: number;
}

/** Server GuessReadiness extends the shared base with reject-cooldown fields.
 *  `evaluateGuessReadiness` always returns these as false/0; the route handler
 *  overrides them with actual session cooldown state before sending the response. */
export interface GuessReadiness extends BaseGuessReadiness {
  blockedByRejectCooldown: boolean;
  rejectCooldownRemaining: number;
}

export interface GameSession {
  id: string;
  characters: ServerCharacter[];
  questions: ServerQuestion[];
  /** Pre-computed at game start (immutable for pool lifetime). Avoids recomputation per answer. */
  coverageMap?: Map<string, number>;
  /** Popularity prior: character id → normalized [0,1] score. Decays with game progress. */
  popularityMap?: Map<string, number>;
  answers: Answer[];
  currentQuestion: ServerQuestion | null;
  difficulty: string;
  maxQuestions: number;
  createdAt: number;
  rejectedGuesses: string[];
  /** Question attribute keys the user has explicitly skipped (excluded from future selection). */
  skippedQuestions: string[];
  guessCount: number;
  postRejectCooldown: number;
  guessAnalytics?: GuessAnalytics;
  /** Detective persona derived from difficulty: sherlock | watson | poirot */
  persona?: string;
  /** A/B variant label stamped at session start. Persisted to game_stats on result. */
  variant?: "control" | "experiment";
  /** Question selector used by this session: 'greedy' (1-step) or 'mcts' (2-step). */
  selector?: "greedy" | "mcts";
  /** AN.11: top-candidate posterior probability after each answer (normalized [0,1]).
   *  Index i corresponds to session.answers[i]. Used to detect the "aha moment" jump. */
  posteriorHistory?: number[];
  /** AN.21: top-10 character candidates (id + name) after each answer.
   *  Index i corresponds to session.answers[i]. Used for catastrophic-failure triage. */
  stepTopTen?: Array<Array<{ id: string; name: string }>>;
  /** Owner userId — stamped on second storeSession call in start.ts once known.
   *  Absent on sessions created before this field was added (legacy). */
  userId?: string;
}

// ── Server-specific constants ─────────────────────────────────────────────────

export const POOL_SIZE = 500;
export const MIN_ATTRIBUTES = 20;
export const SESSION_TTL = 3600; // 1 hour

export const DIFFICULTY_MAP: Record<string, number> = {
  easy: 20,
  medium: 15,
  hard: 10,
};

export const VALID_ANSWERS = new Set<string>(["yes", "no", "maybe", "unknown"]);

/** Bonus questions granted per rejected guess. Hard cap at base × 2. */
export const BONUS_QUESTIONS_PER_REJECT: Record<string, number> = {
  easy: 3,
  medium: 2,
  hard: 2,
};

// ── Typed wrapper functions ───────────────────────────────────────────────────
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

/** Shape of the adaptive runtime data loaded from D1 each turn.
 *  All fields are optional — fetch failures are non-fatal. */
export interface AdaptiveData {
  maybeRateMap: Record<string, number> | undefined;
  netGainMap: Record<string, number> | undefined;
  confusionDiscriminators: Record<string, string[]> | undefined;
  disputeMap: Record<string, Record<string, number>> | undefined;
  attributeTrustMap: Record<string, number> | undefined;
  characterPopularityMap: Record<string, number> | undefined;
  questionEmpiricalGainMap: Record<string, number> | undefined;
  /** C.6: per-attribute multiplier in (0, 1] applied to selector infoGain to
   *  down-weight questions trending toward AN.17 retirement. */
  questionQualityPenaltyMap: Record<string, number> | undefined;
  confusionPairs: Set<string> | undefined;
  /** Promoted ScoringWeights override (kv:engine:weights-active). Honoured
   *  only when auto-tune is enabled and the blob shape is valid. */
  activeWeights: ScoringWeights | undefined;
}

type DisputeRow = {
  character_id: string;
  attribute_key: string;
  confidence: number;
};
type ConfusionPairRow = { character_a: string; character_b: string };

/** Load runtime adaptive data in parallel — best-effort; failures degrade gracefully.
 *  Called on every answer, skip, and reject-guess turn. */
export async function loadAdaptiveData(
  db: D1Database | undefined,
): Promise<AdaptiveData> {
  if (!db) {
    return {
      maybeRateMap: undefined,
      netGainMap: undefined,
      confusionDiscriminators: undefined,
      disputeMap: undefined,
      attributeTrustMap: undefined,
      characterPopularityMap: undefined,
      questionEmpiricalGainMap: undefined,
      questionQualityPenaltyMap: undefined,
      confusionPairs: undefined,
      activeWeights: undefined,
    };
  }

  const [
    maybeRatesRaw,
    netGainsRaw,
    confusionRaw,
    disputeRows,
    attributeTrustRaw,
    characterPopularityRaw,
    questionEmpiricalGainRaw,
    questionQualityPenaltyRaw,
    confusionPairRows,
    activeWeightsRaw,
    autoTuneEnabledRaw,
  ] = await Promise.allSettled([
    d1CacheGet<Record<string, number>>(db, "kv:attribute-maybe-rates"),
    d1CacheGet<Record<string, number>>(db, "kv:attribute-net-gains"),
    d1CacheGet<Record<string, string[]>>(db, "kv:confusion-discriminators"),
    db
      ? db
          .prepare(
            `SELECT character_id, attribute_key, confidence FROM attribute_disputes WHERE status = 'open'`,
          )
          .all<DisputeRow>()
          .then((r) => r.results)
      : Promise.resolve([] as DisputeRow[]),
    d1CacheGet<Record<string, number>>(db, "kv:attribute-trust"),
    d1CacheGet<Record<string, number>>(db, "kv:character-popularity"),
    d1CacheGet<Record<string, number>>(db, "kv:question-empirical-gain"),
    d1CacheGet<Record<string, number>>(db, "kv:question-quality-penalty"),
    db
      ? db
          .prepare(
            `SELECT character_a, character_b FROM character_confusions WHERE confusion_count >= 2`,
          )
          .all<ConfusionPairRow>()
          .then((r) => r.results)
      : Promise.resolve([] as ConfusionPairRow[]),
    d1ConfigGetJson<Record<string, number>>(db, "engine:weights-active"),
    d1ConfigGet(db, "engine:auto-tune-enabled"),
  ]);

  const maybeRateMap =
    maybeRatesRaw.status === "fulfilled"
      ? (maybeRatesRaw.value ?? undefined)
      : undefined;
  const netGainMap =
    netGainsRaw.status === "fulfilled"
      ? (netGainsRaw.value ?? undefined)
      : undefined;
  const confusionDiscriminators =
    confusionRaw.status === "fulfilled"
      ? (confusionRaw.value ?? undefined)
      : undefined;
  const attributeTrustMap =
    attributeTrustRaw.status === "fulfilled"
      ? (attributeTrustRaw.value ?? undefined)
      : undefined;
  const characterPopularityMap =
    characterPopularityRaw.status === "fulfilled"
      ? (characterPopularityRaw.value ?? undefined)
      : undefined;
  const questionEmpiricalGainMap =
    questionEmpiricalGainRaw.status === "fulfilled"
      ? (questionEmpiricalGainRaw.value ?? undefined)
      : undefined;
  const questionQualityPenaltyMap =
    questionQualityPenaltyRaw.status === "fulfilled"
      ? (questionQualityPenaltyRaw.value ?? undefined)
      : undefined;

  let disputeMap: Record<string, Record<string, number>> | undefined;
  if (disputeRows.status === "fulfilled" && disputeRows.value.length > 0) {
    disputeMap = {};
    for (const row of disputeRows.value) {
      disputeMap[row.character_id] ??= {};
      disputeMap[row.character_id]![row.attribute_key] = row.confidence;
    }
  }

  let confusionPairs: Set<string> | undefined;
  if (
    confusionPairRows.status === "fulfilled" &&
    confusionPairRows.value.length > 0
  ) {
    confusionPairs = new Set(
      confusionPairRows.value.map((r) => `${r.character_a}::${r.character_b}`),
    );
  }

  // Auto-tune kill switch: any value other than the literal string 'true'
  // (case-insensitive) means disabled. Defaults to disabled when unset —
  // weights only take effect once explicitly toggled on.
  const autoTuneOn =
    autoTuneEnabledRaw.status === "fulfilled" &&
    typeof autoTuneEnabledRaw.value === "string" &&
    autoTuneEnabledRaw.value.trim().toLowerCase() === "true";

  let activeWeights: ScoringWeights | undefined;
  if (
    autoTuneOn &&
    activeWeightsRaw.status === "fulfilled" &&
    activeWeightsRaw.value
  ) {
    const raw = activeWeightsRaw.value;
    const validKeys = ["match", "mismatch", "maybe", "maybeMiss"] as const;
    const candidate: Record<string, number> = {};
    for (const k of validKeys) {
      const v = raw[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 5) {
        candidate[k] = v;
      }
    }
    if (Object.keys(candidate).length > 0) {
      activeWeights = candidate;
    }
  }

  return {
    maybeRateMap,
    netGainMap,
    confusionDiscriminators,
    disputeMap,
    attributeTrustMap,
    characterPopularityMap,
    questionEmpiricalGainMap,
    questionQualityPenaltyMap,
    confusionPairs,
    activeWeights,
  };
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

// ── Session storage (split pool / mutable state) ──────────────────────────────
// The immutable pool (characters + questions) is stored separately
// so that each answer only rewrites the small mutable session.

interface LeanSession {
  id: string;
  poolKey: string;
  answers: Answer[];
  currentQuestion: ServerQuestion | null;
  difficulty: string;
  maxQuestions: number;
  createdAt: number;
  rejectedGuesses?: string[];
  skippedQuestions?: string[];
  guessCount?: number;
  postRejectCooldown?: number;
  guessAnalytics?: GuessAnalytics;
  variant?: "control" | "experiment";
  selector?: "greedy" | "mcts";
  userId?: string;
}

interface GamePool {
  characters: ServerCharacter[];
  questions: ServerQuestion[];
  /** Serialized coverage map (Map → plain object for JSON storage). */
  coverageMap?: Record<string, number>;
  /** Serialized popularity map (Map → plain object for JSON storage). */
  popularityMap?: Record<string, number>;
}

/** Store a new session — writes both pool and lean state to the session_state D1 table. */
export async function storeSession(
  db: D1Database,
  session: GameSession,
): Promise<void> {
  const poolKey = `pool:${session.id}`;
  const coverageRecord: Record<string, number> | undefined = session.coverageMap
    ? Object.fromEntries(session.coverageMap)
    : undefined;
  const popularityRecord: Record<string, number> | undefined =
    session.popularityMap
      ? Object.fromEntries(session.popularityMap)
      : undefined;
  const pool: GamePool = {
    characters: session.characters,
    questions: session.questions,
    coverageMap: coverageRecord,
    popularityMap: popularityRecord,
  };
  const lean: LeanSession = {
    id: session.id,
    poolKey,
    answers: session.answers,
    currentQuestion: session.currentQuestion,
    difficulty: session.difficulty,
    maxQuestions: session.maxQuestions,
    createdAt: session.createdAt,
    rejectedGuesses: session.rejectedGuesses,
    skippedQuestions: session.skippedQuestions,
    guessCount: session.guessCount,
    postRejectCooldown: session.postRejectCooldown,
    guessAnalytics: session.guessAnalytics,
    variant: session.variant,
    selector: session.selector,
    userId: session.userId,
  };
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await db
    .prepare(
      "INSERT OR REPLACE INTO session_state (id, lean_json, pool_json, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(session.id, JSON.stringify(lean), JSON.stringify(pool), expiresAt)
    .run();
}

/** Load a session from D1 session_state table. Returns null if not found or expired. */
export async function loadSession(
  db: D1Database,
  sessionId: string,
): Promise<GameSession | null> {
  const row = await db
    .prepare(
      "SELECT lean_json, pool_json FROM session_state WHERE id = ? AND expires_at > unixepoch()",
    )
    .bind(sessionId)
    .first<{ lean_json: string; pool_json: string }>();
  if (!row) return null;

  const data = JSON.parse(row.lean_json) as LeanSession;
  const pool = JSON.parse(row.pool_json) as GamePool;

  // Deserialize coverage map plain object → Map
  const coverageMap = pool.coverageMap
    ? new Map(Object.entries(pool.coverageMap))
    : undefined;
  const popularityMap = pool.popularityMap
    ? new Map(Object.entries(pool.popularityMap))
    : undefined;

  return {
    id: data.id,
    characters: pool.characters,
    questions: pool.questions,
    coverageMap,
    popularityMap,
    answers: data.answers,
    currentQuestion: data.currentQuestion,
    difficulty: data.difficulty,
    maxQuestions: data.maxQuestions,
    createdAt: data.createdAt,
    rejectedGuesses: data.rejectedGuesses ?? [],
    skippedQuestions: data.skippedQuestions ?? [],
    guessCount: data.guessCount ?? 0,
    postRejectCooldown: data.postRejectCooldown ?? 0,
    guessAnalytics: data.guessAnalytics,
    variant: data.variant,
    selector: data.selector,
    userId: data.userId,
  };
}

/**
 * Returns true when the request's userId may access the session.
 * Sessions without a stored userId (created before ownership was added) pass
 * through — this avoids breaking live sessions during rollout.
 */
export function verifySessionOwner(
  session: GameSession,
  requestUserId: string,
): boolean {
  if (!session.userId) return true;
  return session.userId === requestUserId;
}

/** Save only mutable session state (lean_json). Much smaller write than storeSession. */
export async function saveSessionState(
  db: D1Database,
  session: GameSession,
): Promise<void> {
  const lean: LeanSession = {
    id: session.id,
    poolKey: `pool:${session.id}`,
    answers: session.answers,
    currentQuestion: session.currentQuestion,
    difficulty: session.difficulty,
    maxQuestions: session.maxQuestions,
    createdAt: session.createdAt,
    rejectedGuesses: session.rejectedGuesses,
    skippedQuestions: session.skippedQuestions,
    guessCount: session.guessCount,
    postRejectCooldown: session.postRejectCooldown,
    guessAnalytics: session.guessAnalytics,
    variant: session.variant,
    selector: session.selector,
    userId: session.userId,
  };
  await db
    .prepare(
      "UPDATE session_state SET lean_json = ?, expires_at = unixepoch() + ? WHERE id = ?",
    )
    .bind(JSON.stringify(lean), SESSION_TTL, session.id)
    .run();
}

/** Delete a session from D1. */
export async function deleteSession(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM session_state WHERE id = ?")
    .bind(sessionId)
    .run();
}

// ── Questions D1 cache ────────────────────────────────────────────────────────────────────────────────────────
// Questions are immutable at runtime — cache for 24h to skip the D1 round-trip.

const QUESTIONS_CACHE_KEY = "meta:questions";
const QUESTIONS_CACHE_TTL = 3600; // 1 hour

/** Load all questions from D1 kv_cache. Returns null on a cache miss. */
export async function loadCachedQuestions(
  db: D1Database,
): Promise<ServerQuestion[] | null> {
  return d1CacheGet<ServerQuestion[]>(db, QUESTIONS_CACHE_KEY);
}

/** Store questions in D1 kv_cache for QUESTIONS_CACHE_TTL seconds. */
export async function storeCachedQuestions(
  db: D1Database,
  questions: ServerQuestion[],
): Promise<void> {
  await d1CachePut(db, QUESTIONS_CACHE_KEY, questions, QUESTIONS_CACHE_TTL);
}
