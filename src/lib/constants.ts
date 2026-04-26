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

// ===== LLM Retry =====
export const LLM_MAX_RETRIES = 2;
export const LLM_RETRY_BASE_MS = 1000;
export const LLM_RETRYABLE_STATUSES = new Set([429, 502, 503]);
export const LLM_NON_RETRYABLE_CODES = new Set(["QUOTA_EXCEEDED", "NO_API_KEY"]);
