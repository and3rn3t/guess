// Questions D1 cache — extracted from _game-engine.ts (RF.2).
// Questions are immutable at runtime — cache for 1h to skip the D1 round-trip.

import { d1CacheGet, d1CachePut } from "../_d1_cache";
import type { ServerQuestion } from "./_engine-types";

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
