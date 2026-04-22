// Server-side game engine.
// Core Bayesian logic: @guess/game-engine (shared package).
// This module adds server-specific types, session management, and typed wrappers.

import type { GameAnswer, GuessReadiness as BaseGuessReadiness } from '@guess/game-engine'
import {
  calculateProbabilities as _calculateProbabilities,
  selectBestQuestion as _selectBestQuestion,
  generateReasoning as _generateReasoning,
  shouldMakeGuess as _shouldMakeGuess,
  evaluateGuessReadiness as _evaluateGuessReadiness,
} from '@guess/game-engine'

// Re-export shared types so existing callers keep their import paths
export type {
  AnswerValue,
  ScoringOptions,
  QuestionSelectionOptions,
  GuessTrigger,
  ReasoningExplanation,
} from '@guess/game-engine'

import type { ScoringOptions, QuestionSelectionOptions } from '@guess/game-engine'
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
  guessCount: number
  postRejectCooldown: number
  guessAnalytics?: GuessAnalytics
}

// ── Server-specific constants ─────────────────────────────────────────────────

export const POOL_SIZE = 500
export const MIN_ATTRIBUTES = 5
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

/** Pick the next question with the highest expected information gain. */
export function selectBestQuestion(
  characters: ServerCharacter[],
  answers: Answer[],
  allQuestions: ServerQuestion[],
  options?: QuestionSelectionOptions
): ServerQuestion | null {
  // Cast is safe: the impl returns one of the elements from allQuestions
  return _selectBestQuestion(characters, answers, allQuestions, options) as ServerQuestion | null
}

/** Build a human-readable explanation of why a question was chosen. */
export function generateReasoning(
  question: ServerQuestion,
  characters: ServerCharacter[],
  answers: Answer[]
) {
  return _generateReasoning(question, characters, answers)
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
  guessCount?: number
  postRejectCooldown?: number
  guessAnalytics?: GuessAnalytics
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
    guessCount: session.guessCount,
    postRejectCooldown: session.postRejectCooldown,
    guessAnalytics: session.guessAnalytics,
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

  const data = JSON.parse(raw) as LeanSession | GameSession

  // Legacy full session (has 'characters' array directly)
  if ('characters' in data) {
    const legacy = data as GameSession
    return {
      ...legacy,
      rejectedGuesses: legacy.rejectedGuesses ?? [],
      guessCount: legacy.guessCount ?? 0,
      postRejectCooldown: legacy.postRejectCooldown ?? 0,
    }
  }

  // New lean format — load pool separately
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
    guessCount: data.guessCount ?? 0,
    postRejectCooldown: data.postRejectCooldown ?? 0,
    guessAnalytics: data.guessAnalytics,
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
    guessCount: session.guessCount,
    postRejectCooldown: session.postRejectCooldown,
    guessAnalytics: session.guessAnalytics,
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
const QUESTIONS_CACHE_TTL = 86400 // 24 hours

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
