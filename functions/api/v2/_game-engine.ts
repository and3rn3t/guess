// Server-side game engine.
// Core Bayesian logic: @guess/game-engine (shared package).
// This module adds server-specific types, session management, and typed wrappers.

import type { GameAnswer, GuessReadiness as BaseGuessReadiness } from '@guess/game-engine'
import {
  calculateProbabilities as _calculateProbabilities,
  selectBestQuestion as _selectBestQuestion,
  selectBestQuestionMCTS as _selectBestQuestionMCTS,
  generateReasoning as _generateReasoning,
  shouldMakeGuess as _shouldMakeGuess,
  evaluateGuessReadiness as _evaluateGuessReadiness,
} from '@guess/game-engine'

// Re-export shared types so existing callers keep their import paths
export type {
  AnswerValue,
  ScoringOptions,
  QuestionSelectionOptions,
  MCTSOptions,
  GuessTrigger,
  ReasoningExplanation,
} from '@guess/game-engine'

import type { ScoringOptions, ScoringWeights, MCTSOptions } from '@guess/game-engine'
export type Answer = GameAnswer

// ── Server-specific types ─────────────────────────────────────────────────────

export interface ServerCharacter {
  id: string
  name: string
  category: string
  imageUrl: string | null
  attributes: Record<string, boolean | null>
}

export interface ServerQuestion {
  id: string
  text: string
  attribute: string
  displayText?: string
  category?: string
}

export interface GuessAnalytics {
  confidence: number
  entropy: number
  remaining: number
  answerDistribution: Record<string, number>
  trigger?: string
  forced?: boolean
  gap?: number
  aliveCount?: number
  questionsRemaining?: number
}

/** Server GuessReadiness extends the shared base with reject-cooldown fields.
 *  `evaluateGuessReadiness` always returns these as false/0; the route handler
 *  overrides them with actual session cooldown state before sending the response. */
export interface GuessReadiness extends BaseGuessReadiness {
  blockedByRejectCooldown: boolean
  rejectCooldownRemaining: number
}

export interface GameSession {
  id: string
  characters: ServerCharacter[]
  questions: ServerQuestion[]
  /** Pre-computed at game start (immutable for pool lifetime). Avoids recomputation per answer. */
  coverageMap?: Map<string, number>
  /** Popularity prior: character id → normalized [0,1] score. Decays with game progress. */
  popularityMap?: Map<string, number>
  answers: Answer[]
  currentQuestion: ServerQuestion | null
  difficulty: string
  maxQuestions: number
  createdAt: number
  rejectedGuesses: string[]
  /** Question attribute keys the user has explicitly skipped (excluded from future selection). */
  skippedQuestions: string[]
  guessCount: number
  postRejectCooldown: number
  guessAnalytics?: GuessAnalytics
  /** Detective persona derived from difficulty: sherlock | watson | poirot */
  persona?: string
  /** A/B variant label stamped at session start. Persisted to game_stats on result. */
  variant?: 'control' | 'experiment'
  /** Question selector used by this session: 'greedy' (1-step) or 'mcts' (2-step). */
  selector?: 'greedy' | 'mcts'
}

// ── Server-specific constants ─────────────────────────────────────────────────

export const POOL_SIZE = 500
export const MIN_ATTRIBUTES = 20
export const SESSION_TTL = 3600 // 1 hour

export const DIFFICULTY_MAP: Record<string, number> = {
  easy: 20,
  medium: 15,
  hard: 10,
}

export const VALID_ANSWERS = new Set<string>(['yes', 'no', 'maybe', 'unknown'])

/** Bonus questions granted per rejected guess. Hard cap at base × 2. */
export const BONUS_QUESTIONS_PER_REJECT: Record<string, number> = {
  easy: 3,
  medium: 2,
  hard: 2,
}

// ── Typed wrapper functions ───────────────────────────────────────────────────
// Each function delegates to the shared engine with ServerCharacter/ServerQuestion
// typed inputs and outputs (structural subtypes of the shared GameCharacter/GameQuestion).

/** Compute Bayesian-style posterior probability for each character. */
export function calculateProbabilities(
  characters: ServerCharacter[],
  answers: Answer[],
  options?: ScoringOptions
): Map<string, number> {
  return _calculateProbabilities(characters, answers, options)
}

/** Pick the next question. Selector defaults to 'mcts' (2-step look-ahead);
 *  pass 'greedy' for the 1-step info-gain selector — used by the A/B control arm. */
export function selectBestQuestion(
  characters: ServerCharacter[],
  answers: Answer[],
  allQuestions: ServerQuestion[],
  options?: MCTSOptions,
  selector: 'greedy' | 'mcts' = 'mcts'
): ServerQuestion | null {
  // Cast is safe: the impl returns one of the elements from allQuestions
  const impl = selector === 'greedy' ? _selectBestQuestion : _selectBestQuestionMCTS
  return impl(characters, answers, allQuestions, options) as ServerQuestion | null
}

/** Build a human-readable explanation of why a question was chosen. */
export function generateReasoning(
  question: ServerQuestion,
  characters: ServerCharacter[],
  answers: Answer[],
  scoring?: ScoringOptions
) {
  return _generateReasoning(question, characters, answers, scoring)
}

/** Decide whether confidence is high enough to guess (thin wrapper). */
export function shouldMakeGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses = 0,
  scoring?: ScoringOptions
): boolean {
  return _shouldMakeGuess(
    characters,
    answers,
    questionCount,
    maxQuestions,
    priorWrongGuesses,
    scoring
  )
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
  preComputedProbs?: Map<string, number>
): GuessReadiness {
  return {
    ..._evaluateGuessReadiness(
      characters,
      answers,
      questionCount,
      maxQuestions,
      priorWrongGuesses,
      scoring,
      preComputedProbs
    ),
    blockedByRejectCooldown: false,
    rejectCooldownRemaining: 0,
  }
}

/** Return the best guess character, excluding previously rejected guesses. */
export function getBestGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = [],
  scoring?: ScoringOptions
): ServerCharacter | null {
  return getBestGuessResult(characters, answers, rejectedGuesses, scoring).character
}

/** Like getBestGuess but also returns the probability map, avoiding a redundant
 *  calculateProbabilities call in the caller when confidence/entropy are needed. */
export function getBestGuessResult(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = [],
  scoring?: ScoringOptions
): { character: ServerCharacter | null; probs: Map<string, number> } {
  if (characters.length === 0) return { character: null, probs: new Map() }

  const rejectedSet = new Set(rejectedGuesses)
  const eligible = characters.filter((c) => !rejectedSet.has(c.id))
  if (eligible.length === 0) return { character: null, probs: new Map() }

  const probs = _calculateProbabilities(eligible, answers, scoring)
  const sorted = Array.from(probs.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const bestId = sorted[0][0]
  const character = eligible.find((c) => c.id === bestId) ?? eligible[0]
  return { character, probs }
}

/** Check for contradictions (all characters eliminated). */
export function detectContradictions(
  characters: ServerCharacter[],
  answers: Answer[]
): { hasContradiction: boolean; remainingCount: number } {
  if (answers.length === 0) return { hasContradiction: false, remainingCount: characters.length }
  // Delegates to filterPossibleCharacters for consistency with the game loop
  const remaining = filterPossibleCharacters(characters, answers).length
  return { hasContradiction: remaining === 0, remainingCount: remaining }
}

/** Hard-filter characters based on definitive answers and rejected guesses.
 *  Allows up to MAX_MISMATCHES contradictions to tolerate bad attribute data
 *  or occasional user errors (e.g. enrichment error + one mis-tap). */
const MAX_MISMATCHES = 2

export function filterPossibleCharacters(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = []
): ServerCharacter[] {
  const rejectedSet = new Set(rejectedGuesses)
  return characters.filter((char) => {
    if (rejectedSet.has(char.id)) return false
    let mismatches = 0
    for (const answer of answers) {
      const attr = char.attributes[answer.questionId]
      if (answer.value === 'yes' && attr === false) mismatches++
      else if (answer.value === 'no' && attr === true) mismatches++
      if (mismatches > MAX_MISMATCHES) return false
    }
    return true
  })
}

// ── Server utilities ──────────────────────────────────────────────────────────

/** Parse the denormalized attributes_json column into a typed attribute map.
 *  Shared by game/start.ts and game/resume.ts. */
export function parseAttrsJson(json: string): Record<string, boolean | null> {
  try {
    const raw = JSON.parse(json) as Record<string, number>
    const result: Record<string, boolean | null> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (val === 1) { result[key] = true }
      else if (val === 0) { result[key] = false }
      else { result[key] = null }
    }
    return result
  } catch {
    return {}
  }
}

/** Shape of the adaptive runtime data loaded from KV + D1 each turn.
 *  All fields are optional — fetch failures are non-fatal. */
export interface AdaptiveData {
  maybeRateMap: Record<string, number> | undefined
  netGainMap: Record<string, number> | undefined
  confusionDiscriminators: Record<string, string[]> | undefined
  disputeMap: Record<string, Record<string, number>> | undefined
  attributeTrustMap: Record<string, number> | undefined
  characterPopularityMap: Record<string, number> | undefined
  questionEmpiricalGainMap: Record<string, number> | undefined
  confusionPairs: Set<string> | undefined
  /** Promoted ScoringWeights override (kv:engine:weights-active). Honoured
   *  only when auto-tune is enabled and the blob shape is valid. */
  activeWeights: ScoringWeights | undefined
}

type DisputeRow = { character_id: string; attribute_key: string; confidence: number }
type ConfusionPairRow = { character_a: string; character_b: string }

/** Load runtime adaptive data in parallel — best-effort; failures degrade gracefully.
 *  Called on every answer, skip, and reject-guess turn. */
export async function loadAdaptiveData(
  kv: KVNamespace,
  db: D1Database | undefined
): Promise<AdaptiveData> {
  const [
    maybeRatesRaw,
    netGainsRaw,
    confusionRaw,
    disputeRows,
    attributeTrustRaw,
    characterPopularityRaw,
    questionEmpiricalGainRaw,
    confusionPairRows,
    activeWeightsRaw,
    autoTuneEnabledRaw,
  ] = await Promise.allSettled([
    kv.get('kv:attribute-maybe-rates', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:attribute-net-gains', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:confusion-discriminators', 'json') as Promise<Record<string, string[]> | null>,
    db
      ? db.prepare(`SELECT character_id, attribute_key, confidence FROM attribute_disputes WHERE status = 'open'`)
           .all<DisputeRow>()
           .then((r) => r.results)
      : Promise.resolve([] as DisputeRow[]),
    kv.get('kv:attribute-trust', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:character-popularity', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:question-empirical-gain', 'json') as Promise<Record<string, number> | null>,
    db
      ? db.prepare(`SELECT character_a, character_b FROM character_confusions WHERE confusion_count >= 2`)
           .all<ConfusionPairRow>()
           .then((r) => r.results)
      : Promise.resolve([] as ConfusionPairRow[]),
    kv.get('kv:engine:weights-active', 'json') as Promise<Record<string, number> | null>,
    kv.get('kv:engine:auto-tune-enabled') as Promise<string | null>,
  ])

  const maybeRateMap = maybeRatesRaw.status === 'fulfilled' ? (maybeRatesRaw.value ?? undefined) : undefined
  const netGainMap = netGainsRaw.status === 'fulfilled' ? (netGainsRaw.value ?? undefined) : undefined
  const confusionDiscriminators = confusionRaw.status === 'fulfilled' ? (confusionRaw.value ?? undefined) : undefined
  const attributeTrustMap = attributeTrustRaw.status === 'fulfilled' ? (attributeTrustRaw.value ?? undefined) : undefined
  const characterPopularityMap = characterPopularityRaw.status === 'fulfilled' ? (characterPopularityRaw.value ?? undefined) : undefined
  const questionEmpiricalGainMap = questionEmpiricalGainRaw.status === 'fulfilled' ? (questionEmpiricalGainRaw.value ?? undefined) : undefined

  let disputeMap: Record<string, Record<string, number>> | undefined
  if (disputeRows.status === 'fulfilled' && disputeRows.value.length > 0) {
    disputeMap = {}
    for (const row of disputeRows.value) {
      disputeMap[row.character_id] ??= {}
      disputeMap[row.character_id]![row.attribute_key] = row.confidence
    }
  }

  let confusionPairs: Set<string> | undefined
  if (confusionPairRows.status === 'fulfilled' && confusionPairRows.value.length > 0) {
    confusionPairs = new Set(confusionPairRows.value.map((r) => `${r.character_a}::${r.character_b}`))
  }

  // Auto-tune kill switch: any value other than the literal string 'true'
  // (case-insensitive) means disabled. Defaults to disabled when unset —
  // weights only take effect once explicitly toggled on.
  const autoTuneOn =
    autoTuneEnabledRaw.status === 'fulfilled' &&
    typeof autoTuneEnabledRaw.value === 'string' &&
    autoTuneEnabledRaw.value.trim().toLowerCase() === 'true'

  let activeWeights: ScoringWeights | undefined
  if (autoTuneOn && activeWeightsRaw.status === 'fulfilled' && activeWeightsRaw.value) {
    const raw = activeWeightsRaw.value
    const validKeys = ['match', 'mismatch', 'maybe', 'maybeMiss'] as const
    const candidate: Record<string, number> = {}
    for (const k of validKeys) {
      const v = raw[k]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5) {
        candidate[k] = v
      }
    }
    if (Object.keys(candidate).length > 0) {
      activeWeights = candidate
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
    confusionPairs,
    activeWeights,
  }
}

/** Return the session's pre-computed coverage map, or build it on-the-fly for
 *  sessions created before the coverage map optimization. */
export function getOrBuildCoverageMap(session: GameSession): Map<string, number> {
  if (session.coverageMap) return session.coverageMap
  const coverageMap = new Map<string, number>()
  const charCount = session.characters.length
  for (const q of session.questions) {
    const known = session.characters.filter((c) => c.attributes[q.attribute] != null).length
    coverageMap.set(q.attribute, known / charCount)
  }
  return coverageMap
}

/** Build the MCTSOptions object for selectBestQuestion from session context + adaptive data.
 *  Pass extras for per-turn values (progress, pre-computed probs, recent question categories). */
export function buildQuestionOptions(
  session: GameSession,
  scoring: ScoringOptions,
  adaptive: AdaptiveData,
  extras?: { progress?: number; probs?: Map<string, number>; recentCategories?: string[] }
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
    mctsEndgameThreshold: session.difficulty === 'hard' ? 0.70 : undefined,
    gameDifficulty: session.difficulty as 'easy' | 'medium' | 'hard',
    maybeRateMap: adaptive.maybeRateMap,
    netGainMap: adaptive.netGainMap,
    confusionDiscriminators: adaptive.confusionDiscriminators,
    questionEmpiricalGainMap: adaptive.questionEmpiricalGainMap,
    confusionPairs: adaptive.confusionPairs,
  }
}

// ── Session storage (split pool / mutable state) ──────────────────────────────
// The immutable pool (characters + questions) is stored separately
// so that each answer only rewrites the small mutable session.

interface LeanSession {
  id: string
  poolKey: string
  answers: Answer[]
  currentQuestion: ServerQuestion | null
  difficulty: string
  maxQuestions: number
  createdAt: number
  rejectedGuesses?: string[]
  skippedQuestions?: string[]
  guessCount?: number
  postRejectCooldown?: number
  guessAnalytics?: GuessAnalytics
  variant?: 'control' | 'experiment'
  selector?: 'greedy' | 'mcts'
}

interface GamePool {
  characters: ServerCharacter[]
  questions: ServerQuestion[]
  /** Serialized coverage map (Map → plain object for JSON storage). */
  coverageMap?: Record<string, number>
  /** Serialized popularity map (Map → plain object for JSON storage). */
  popularityMap?: Record<string, number>
}

/** Store a new session — writes both pool (immutable) and lean session (mutable). */
export async function storeSession(kv: KVNamespace, session: GameSession): Promise<void> {
  const poolKey = `pool:${session.id}`
  // Serialize Map → plain object for JSON
  const coverageRecord: Record<string, number> | undefined = session.coverageMap
    ? Object.fromEntries(session.coverageMap)
    : undefined
  const popularityRecord: Record<string, number> | undefined = session.popularityMap
    ? Object.fromEntries(session.popularityMap)
    : undefined
  const pool: GamePool = {
    characters: session.characters,
    questions: session.questions,
    coverageMap: coverageRecord,
    popularityMap: popularityRecord,
  }
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
  }
  await Promise.all([
    kv.put(poolKey, JSON.stringify(pool), { expirationTtl: SESSION_TTL }),
    kv.put(`game:${session.id}`, JSON.stringify(lean), { expirationTtl: SESSION_TTL }),
  ])
}

/** Load a session from KV — handles both legacy (full) and new (lean + pool) formats. */
export async function loadSession(kv: KVNamespace, sessionId: string): Promise<GameSession | null> {
  const raw = await kv.get(`game:${sessionId}`)
  if (!raw) return null

  const data = JSON.parse(raw) as LeanSession

  // Load pool separately
  const poolStr = await kv.get(data.poolKey)
  if (!poolStr) return null
  const pool = JSON.parse(poolStr) as GamePool

  // Deserialize coverage map plain object → Map
  const coverageMap = pool.coverageMap ? new Map(Object.entries(pool.coverageMap)) : undefined
  const popularityMap = pool.popularityMap ? new Map(Object.entries(pool.popularityMap)) : undefined

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
  }
}

/** Save only mutable session state (answers + currentQuestion). Much smaller write. */
export async function saveSessionState(kv: KVNamespace, session: GameSession): Promise<void> {
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
  }
  await kv.put(`game:${session.id}`, JSON.stringify(lean), { expirationTtl: SESSION_TTL })
}

/** Delete a session and its pool from KV. */
export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  await Promise.all([kv.delete(`game:${sessionId}`), kv.delete(`pool:${sessionId}`)])
}

// ── Questions KV cache ────────────────────────────────────────────────────────
// Questions are immutable at runtime — cache for 24h to skip the D1 round-trip.

const QUESTIONS_CACHE_KEY = 'meta:questions'
const QUESTIONS_CACHE_TTL = 3600 // 1 hour

/** Load all questions from KV cache. Returns null on a cache miss. */
export async function loadCachedQuestions(kv: KVNamespace): Promise<ServerQuestion[] | null> {
  return kv.get<ServerQuestion[]>(QUESTIONS_CACHE_KEY, 'json')
}

/** Store questions in KV for QUESTIONS_CACHE_TTL seconds. */
export async function storeCachedQuestions(
  kv: KVNamespace,
  questions: ServerQuestion[]
): Promise<void> {
  await kv.put(QUESTIONS_CACHE_KEY, JSON.stringify(questions), {
    expirationTtl: QUESTIONS_CACHE_TTL,
  })
}
