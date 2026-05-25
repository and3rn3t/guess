// ===== Storage / KV Keys =====
export const KV_USER_ID = "kv:user-id";
export const KV_ANALYTICS = "kv:analytics";
export const KV_TOKEN_USAGE = "kv:token-usage";
export const KV_CHARACTERS_CACHE = "kv:characters-cache";
export const KV_QUESTIONS_CACHE = "kv:questions-cache";
export const KV_GAME_SESSION = "kv:game-session";
export const KV_SOUND_MUTED = "kv:sound-muted";

// ===== Session / Preference Keys =====
export const SERVER_SESSION_KEY = "server-session-id";
export const ONBOARDING_COMPLETE_KEY = "onboarding-complete";
export const PREF_DIFFICULTY_KEY = "pref:difficulty";
export const PREF_CATEGORIES_KEY = "pref:categories";

// ===== App Routes / Navigation =====
export const APP_ROUTE_ADMIN = "/admin";
export const PRIMARY_NAV_PHASES: readonly string[] = [
	"welcome",
	"stats",
	"history",
	"compare",
];

// ===== API Endpoints =====
export const GAME_API_ENDPOINTS = {
	start: "/api/v2/game/start",
	answer: "/api/v2/game/answer",
	skip: "/api/v2/game/skip",
	rejectGuess: "/api/v2/game/reject-guess",
	result: "/api/v2/game/result",
	resume: "/api/v2/game/resume",
	reveal: "/api/v2/game/reveal",
	feedback: "/api/v2/game/feedback",
	daily: "/api/v2/daily",
	dailyLeaderboard: "/api/v2/daily/leaderboard",
} as const;

export const ADMIN_API_ENDPOINTS = {
	characters: "/api/admin/characters",
	community: "/api/admin/community",
	communityRejected: "/api/admin/community/rejected",
	experiments: "/api/admin/experiments",
	questions: "/api/admin/questions",
	questionsBulk: "/api/admin/questions/bulk",
	questionsExpand: "/api/admin/questions/expand",
	questionRetirementQueue: "/api/admin/questions/retirement-queue",
	questionDuplicatesBackfill: "/api/admin/questions/duplicates/backfill",
	questionDuplicatesDismiss: "/api/admin/questions/duplicates/dismiss",
	questionDuplicatesMerge: "/api/admin/questions/duplicates/merge",
	automationStatus: "/api/admin/automation-status",
	proposedAttributes: "/api/admin/proposed-attributes",
	attributeDisputes: "/api/admin/attribute-disputes",
	attributeDisputesAi: "/api/admin/attribute-disputes-ai",
	resolveStack: "/api/admin/resolve-stack",
	errorLogs: "/api/admin/error-logs",
	cspViolations: "/api/admin/security/csp-violations",
	cspDigest: "/api/admin/security/csp-digest",
} as const;

export function adminCharacterPath(id: string): string {
	return `${ADMIN_API_ENDPOINTS.characters}/${encodeURIComponent(id)}`;
}

export function adminQuestionPath(key: string): string {
	return `${ADMIN_API_ENDPOINTS.questions}/${encodeURIComponent(key)}`;
}

export function adminQuestionScorePath(key: string): string {
	return `${adminQuestionPath(key)}/score`;
}

export function adminQuestionRetirePath(key: string): string {
	return `${adminQuestionPath(key)}/retire`;
}

export function adminQuestionUnretirePath(key: string): string {
	return `${adminQuestionPath(key)}/unretire`;
}

export function adminProposedAttributePath(id: number): string {
	return `${ADMIN_API_ENDPOINTS.proposedAttributes}/${id}`;
}

export function adminProposedAttributeScorePath(id: number): string {
	return `${adminProposedAttributePath(id)}/score`;
}

// ===== Analytics =====
export const MAX_ANALYTICS_EVENTS = 500;

// ===== Sync =====
export const SYNC_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ===== LLM Retry =====
export const LLM_MAX_RETRIES = 2;
export const LLM_RETRY_BASE_MS = 1000;
export const LLM_RETRYABLE_STATUSES = new Set([429, 502, 503]);
export const LLM_NON_RETRYABLE_CODES = new Set(["QUOTA_EXCEEDED", "NO_API_KEY"]);
