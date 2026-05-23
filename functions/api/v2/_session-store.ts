// Session storage (split pool / mutable state).
// The immutable pool (characters + questions) is stored separately
// so each answer only rewrites the small mutable session.
//
// Extracted from _game-engine.ts (RF.2) without behavior change.

import type {
  Answer,
  GameSession,
  GuessAnalytics,
  ServerCharacter,
  ServerQuestion,
} from "./_engine-types";
import { SESSION_TTL } from "./_engine-types";

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
