/**
 * Pure transport layer for the v2 server-game API.
 *
 * No React, no toasts, no analytics-side-effects beyond a single
 * `reportFetchError` helper that hands off to the lazy analytics module.
 * Hooks compose these calls and own the UI/state side effects.
 */
import { httpClient, HttpError } from "@/lib/http";
import type {
  AnswerValue,
  CharacterCategory,
  Difficulty,
  GuessReadinessSnapshot,
  Question,
  ReasoningExplanation,
} from "@/lib/types";

export { HttpError };

const analytics = () => import("@/lib/analytics");

export function reportFetchError(endpoint: string, err: unknown): void {
  const status = err instanceof HttpError ? err.status : 0;
  const message = err instanceof Error ? err.message : String(err);
  void analytics().then((m) => m.trackServerError(endpoint, status, message));
}

// ── Response types ───────────────────────────────────────────

export interface StartResponse {
  sessionId: string;
  question: Question;
  reasoning: ReasoningExplanation;
  totalCharacters: number;
  maxQuestions?: number;
}

export interface AnswerResponse {
  type: "question" | "guess" | "contradiction";
  question?: Question;
  reasoning?: ReasoningExplanation;
  character?: {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
  };
  confidence?: number;
  remaining?: number;
  eliminated?: number;
  questionCount?: number;
  guessCount?: number;
  message?: string;
  readiness?: {
    trigger?: GuessReadinessSnapshot["trigger"];
    blockedByRejectCooldown?: boolean;
    rejectCooldownRemaining?: number;
    topProbability?: number;
    gap?: number;
    aliveCount?: number;
    questionsRemaining?: number;
    forced?: boolean;
  };
}

export interface SkipResponse {
  type: "question";
  question: Question;
  reasoning: ReasoningExplanation;
  remaining: number;
  questionCount: number;
  skippedCount: number;
}

export interface RejectGuessResponse {
  type: "question" | "exhausted";
  question?: Question;
  reasoning?: ReasoningExplanation;
  remaining?: number;
  questionCount?: number;
  maxQuestions?: number;
  guessCount?: number;
  rejectCooldownRemaining?: number;
  message?: string;
}

export interface ResumeResponse {
  expired: boolean;
  question?: Question;
  reasoning?: ReasoningExplanation;
  remaining?: number;
  totalCharacters?: number;
  questionCount?: number;
  guessCount?: number;
  answers?: Array<{ questionId: string; value: AnswerValue }>;
}

/** Fills in default values so callers can rely on a complete snapshot. */
export function normalizeReadiness(
  readiness?: Partial<GuessReadinessSnapshot> | null,
): GuessReadinessSnapshot | null {
  if (!readiness) return null;
  return {
    trigger: readiness.trigger ?? "insufficient_data",
    blockedByRejectCooldown: readiness.blockedByRejectCooldown ?? false,
    rejectCooldownRemaining: readiness.rejectCooldownRemaining ?? 0,
    topProbability: readiness.topProbability,
    gap: readiness.gap,
    aliveCount: readiness.aliveCount,
    questionsRemaining: readiness.questionsRemaining,
    forced: readiness.forced,
  };
}

// ── Transport ────────────────────────────────────────────────

export interface StartGameInput {
  categories: CharacterCategory[];
  difficulty: Difficulty;
  characterId?: string;
}

export function startGame(input: StartGameInput): Promise<StartResponse> {
  return httpClient.postJson<StartResponse>("/api/v2/game/start", {
    categories: input.categories.length ? input.categories : undefined,
    difficulty: input.difficulty,
    characterId: input.characterId ?? undefined,
  });
}

export function submitAnswer(
  sessionId: string,
  value: AnswerValue,
): Promise<AnswerResponse> {
  return httpClient.postJson<AnswerResponse>("/api/v2/game/answer", {
    sessionId,
    value,
  });
}

/**
 * Skip the current question. Returns `null` for the 409 response (no more
 * questions); throws on any other non-OK status.
 */
export async function skipQuestion(
  sessionId: string,
): Promise<SkipResponse | null> {
  const res = await httpClient.request("/api/v2/game/skip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (res.status === 409) return null;
  if (!res.ok) throw new HttpError(res.status, "Failed to skip question");
  return (await res.json()) as SkipResponse;
}

export function rejectGuess(
  sessionId: string,
  characterId: string,
): Promise<RejectGuessResponse> {
  return httpClient.postJson<RejectGuessResponse>(
    "/api/v2/game/reject-guess",
    { sessionId, characterId },
  );
}

export function submitResult(
  sessionId: string,
  correct: boolean,
): Promise<Response> {
  return httpClient.request("/api/v2/game/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, correct }),
  });
}

export function resumeGame(sessionId: string): Promise<ResumeResponse | null> {
  return httpClient
    .request("/api/v2/game/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
    .then((res) => (res.ok ? (res.json() as Promise<ResumeResponse>) : null));
}
