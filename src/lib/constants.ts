// ===== Storage / KV Keys =====
export const KV_USER_ID = "kv:user-id";
export const KV_ANALYTICS = "kv:analytics";
export const KV_TOKEN_USAGE = "kv:token-usage";
export const KV_CHARACTERS_CACHE = "kv:characters-cache";
export const KV_QUESTIONS_CACHE = "kv:questions-cache";

// ===== Analytics =====
export const MAX_ANALYTICS_EVENTS = 500;

// ===== Sync =====
export const SYNC_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ===== Game Engine: Bayesian Scoring =====
export const SCORE_MATCH = 1.0; // attribute matches answer
export const SCORE_MISMATCH = 0.05; // Non-zero: resilient to 1-2 bad attribute values or user errors
export const SCORE_UNKNOWN = 0.35; // attribute is null/undefined — lower than 0.5 to penalize sparse coverage
export const SCORE_MAYBE = 0.7; // "maybe" answer with matching attribute
export const SCORE_MAYBE_MISS = 0.3; // "maybe" answer with contradicting attribute

// ===== Game Engine: Question Selection =====
export const MAYBE_ANSWER_PROB = 0.15; // estimated probability user answers "maybe"
export const ALIVE_THRESHOLD = 0.001; // probability below which a character is effectively eliminated

// ===== LLM Retry =====
export const LLM_MAX_RETRIES = 2;
export const LLM_RETRY_BASE_MS = 1000;
export const LLM_RETRYABLE_STATUSES = new Set([429, 502, 503]);
export const LLM_NON_RETRYABLE_CODES = new Set(["QUOTA_EXCEEDED", "NO_API_KEY"]);
