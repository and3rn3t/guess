import {
  drainMobileQueuedActions,
  enqueueMobileQueuedFeedbackAction,
  enqueueMobileQueuedResultAction,
  getMobileQueuedActionCount,
  onMobileQueuedActionCountChange,
  replaceMobileQueuedActions
} from './mobileOfflineQueue';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type AnswerValue = 'yes' | 'no' | 'maybe' | 'unknown';

export interface MobileQuestion {
  id: string;
  text: string;
  attribute: string;
  displayText?: string;
}

export interface MobileReasoning {
  why: string;
  impact: string;
  remaining: number;
  confidence: number;
}

export interface MobileStartResponse {
  sessionId: string;
  question: MobileQuestion;
  reasoning: MobileReasoning;
}

export interface MobileResumeResponse {
  question: MobileQuestion;
  reasoning: MobileReasoning;
  guessCount: number;
}

export interface MobileGuessCandidate {
  id: string;
  name: string;
  category: string;
}

export type MobileAnswerResponse =
  | {
      type: 'question';
      question: MobileQuestion;
      reasoning: MobileReasoning;
      remaining?: number;
    }
  | {
      type: 'guess';
      character: MobileGuessCandidate;
      confidence?: number;
      remaining?: number;
    }
  | {
      type: 'contradiction';
      message?: string;
      question?: MobileQuestion;
      reasoning?: MobileReasoning;
    };

export interface MobileSkipResponse {
  type: 'question';
  question: MobileQuestion;
  reasoning: MobileReasoning;
  remaining: number;
  questionCount: number;
  skippedCount: number;
}

export type MobileRejectGuessResponse =
  | {
      type: 'question';
      question: MobileQuestion;
      reasoning: MobileReasoning;
      rejectCooldownRemaining?: number;
      guessCount?: number;
    }
  | {
      type: 'exhausted';
      message?: string;
    };

export interface MobileStatsByDifficulty {
  difficulty: string;
  games: number;
  wins: number;
  winRate: number;
  avgQuestions: number;
}

export interface MobileRecentGame {
  won: boolean;
  difficulty: string;
  questionsAsked: number;
  poolSize: number;
  timestamp: number;
}

export interface MobileStatsOverview {
  totalGames: number;
  wins: number;
  winRate: number;
  avgQuestions: number;
  avgPoolSize: number;
  byDifficulty: MobileStatsByDifficulty[];
  recentGames: MobileRecentGame[];
}

export interface MobileHistoryGame {
  id: string;
  characterId: string;
  characterName: string;
  won: boolean;
  difficulty: string;
  questionsAsked: number;
  poolSize: number;
  timestamp: number;
}

const ENDPOINTS = {
  start: '/api/v2/game/start',
  answer: '/api/v2/game/answer',
  skip: '/api/v2/game/skip',
  rejectGuess: '/api/v2/game/reject-guess',
  result: '/api/v2/game/result',
  resume: '/api/v2/game/resume',
  feedback: '/api/v2/game/feedback',
  stats: '/api/v2/stats',
  history: '/api/v2/history',
  daily: '/api/v2/daily',
  dailyLeaderboard: '/api/v2/daily/leaderboard'
} as const;

const DEFAULT_TIMEOUT_MS = 10_000;
const TRANSPORT_RETRY_COUNT = 1;
const TRANSPORT_RETRY_DELAY_MS = 250;

export type MobileSyncStatus = 'synced' | 'pending' | 'offline' | 'error';

let syncStatus: MobileSyncStatus = 'synced';
let activeRequestCount = 0;
const syncStatusListeners = new Set<(status: MobileSyncStatus) => void>();

function emitSyncStatus(status: MobileSyncStatus): void {
  syncStatus = status;
  for (const listener of syncStatusListeners) {
    listener(status);
  }
}

function beginSyncRequest(): void {
  activeRequestCount += 1;
  emitSyncStatus('pending');
}

function settleSyncRequest(status: Exclude<MobileSyncStatus, 'pending'>): void {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  if (activeRequestCount > 0) {
    emitSyncStatus('pending');
    return;
  }

  emitSyncStatus(status);
}

export function getMobileSyncStatus(): MobileSyncStatus {
  return syncStatus;
}

export function onMobileSyncStatusChange(listener: (status: MobileSyncStatus) => void): () => void {
  syncStatusListeners.add(listener);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'transport' | 'server' | 'validation',
    readonly status?: number
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

interface StartGameInput {
  difficulty: Difficulty;
  categories: readonly string[];
  characterId?: string;
}

function getApiBaseUrl(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  if (raw.length > 0) {
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  if (__DEV__) {
    return 'http://127.0.0.1:8788';
  }

  return '';
}

function toUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) {
    throw new MobileApiError(
      'API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL.',
      'validation'
    );
  }

  return `${base}${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isTransportError(error: unknown): error is MobileApiError {
  return error instanceof MobileApiError && error.kind === 'transport';
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function withTransportRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (attempt <= TRANSPORT_RETRY_COUNT) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (!isTransportError(error) || attempt > TRANSPORT_RETRY_COUNT) {
        throw error;
      }

      await sleep(TRANSPORT_RETRY_DELAY_MS);
    }
  }

  throw new MobileApiError('Network request failed', 'transport');
}

function parseQuestion(value: unknown): MobileQuestion {
  if (!isRecord(value)) {
    throw new MobileApiError('Invalid question payload', 'validation');
  }

  const id = value.id;
  const text = value.text;
  const attribute = value.attribute;
  const displayText = value.displayText;

  if (typeof id !== 'string' || typeof text !== 'string' || typeof attribute !== 'string') {
    throw new MobileApiError('Question fields are malformed', 'validation');
  }

  return {
    id,
    text,
    attribute,
    displayText: typeof displayText === 'string' ? displayText : undefined
  };
}

function parseReasoning(value: unknown): MobileReasoning {
  if (!isRecord(value)) {
    throw new MobileApiError('Invalid reasoning payload', 'validation');
  }

  const why = value.why;
  const impact = value.impact;
  const remaining = value.remaining;
  const confidence = value.confidence;

  if (
    typeof why !== 'string' ||
    typeof impact !== 'string' ||
    typeof remaining !== 'number' ||
    typeof confidence !== 'number'
  ) {
    throw new MobileApiError('Reasoning fields are malformed', 'validation');
  }

  return {
    why,
    impact,
    remaining,
    confidence
  };
}

function parseGuess(value: unknown): MobileGuessCandidate {
  if (!isRecord(value)) {
    throw new MobileApiError('Invalid guess payload', 'validation');
  }

  const id = value.id;
  const name = value.name;
  const category = value.category;

  if (typeof id !== 'string' || typeof name !== 'string' || typeof category !== 'string') {
    throw new MobileApiError('Guess fields are malformed', 'validation');
  }

  return {
    id,
    name,
    category
  };
}

async function postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await postRaw(path, body);

  if (!response.ok) {
    throw new MobileApiError(`Server request failed (${response.status})`, 'server', response.status);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await response.text()).slice(0, 140).replaceAll(/\s+/g, ' ').trim();
    throw new MobileApiError(
      `Server returned non-JSON response for ${response.url}: ${preview || 'empty response'}`,
      'validation',
      response.status
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new MobileApiError(`Server returned invalid JSON for ${response.url}`, 'validation', response.status);
  }
}

async function getJson(path: string): Promise<unknown> {
  const response = await getRaw(path);

  if (!response.ok) {
    throw new MobileApiError(`Server request failed (${response.status})`, 'server', response.status);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await response.text()).slice(0, 140).replaceAll(/\s+/g, ' ').trim();
    throw new MobileApiError(
      `Server returned non-JSON response for ${response.url}: ${preview || 'empty response'}`,
      'validation',
      response.status
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new MobileApiError(`Server returned invalid JSON for ${response.url}`, 'validation', response.status);
  }
}

async function postRaw(path: string, body: Record<string, unknown>): Promise<Response> {
  beginSyncRequest();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(toUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    settleSyncRequest('synced');
    return response;
  } catch (error) {
    if (error instanceof MobileApiError) {
      settleSyncRequest(error.kind === 'transport' ? 'offline' : 'error');
      throw error;
    }

    settleSyncRequest('offline');
    throw new MobileApiError('Network request failed', 'transport');
  } finally {
    clearTimeout(timeout);
  }
}

async function getRaw(path: string): Promise<Response> {
  beginSyncRequest();

  try {
    const response = await withTransportRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        return await fetch(toUrl(path), {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          },
          signal: controller.signal
        });
      } catch (error) {
        if (error instanceof MobileApiError) {
          throw error;
        }
        throw new MobileApiError('Network request failed', 'transport');
      } finally {
        clearTimeout(timeout);
      }
    });
    settleSyncRequest('synced');
    return response;
  } catch (error) {
    if (error instanceof MobileApiError) {
      settleSyncRequest(error.kind === 'transport' ? 'offline' : 'error');
      throw error;
    }

    settleSyncRequest('error');
    throw error;
  }
}

function parseStatsOverview(payload: unknown): MobileStatsOverview {
  if (!isRecord(payload)) {
    throw new MobileApiError('Invalid stats response payload', 'validation');
  }

  const gameStats = payload.gameStats;
  if (!isRecord(gameStats)) {
    return {
      totalGames: 0,
      wins: 0,
      winRate: 0,
      avgQuestions: 0,
      avgPoolSize: 0,
      byDifficulty: [],
      recentGames: []
    };
  }

  const byDifficulty = Array.isArray(gameStats.byDifficulty)
    ? gameStats.byDifficulty
        .map((entry): MobileStatsByDifficulty | null => {
          if (!isRecord(entry)) {
            return null;
          }

          const difficulty = asString(entry.difficulty);
          const games = asNumber(entry.games);
          const wins = asNumber(entry.wins);
          const winRate = asNumber(entry.winRate);
          const avgQuestions = asNumber(entry.avgQuestions);
          if (
            difficulty === null ||
            games === null ||
            wins === null ||
            winRate === null ||
            avgQuestions === null
          ) {
            return null;
          }

          return {
            difficulty,
            games,
            wins,
            winRate,
            avgQuestions
          };
        })
        .filter((entry): entry is MobileStatsByDifficulty => entry !== null)
    : [];

  const recentGames = Array.isArray(gameStats.recentGames)
    ? gameStats.recentGames
        .map((entry): MobileRecentGame | null => {
          if (!isRecord(entry)) {
            return null;
          }

          const won = entry.won;
          const difficulty = asString(entry.difficulty);
          const questionsAsked = asNumber(entry.questionsAsked);
          const poolSize = asNumber(entry.poolSize);
          const timestamp = asNumber(entry.timestamp);
          if (
            typeof won !== 'boolean' ||
            difficulty === null ||
            questionsAsked === null ||
            poolSize === null ||
            timestamp === null
          ) {
            return null;
          }

          return {
            won,
            difficulty,
            questionsAsked,
            poolSize,
            timestamp
          };
        })
        .filter((entry): entry is MobileRecentGame => entry !== null)
    : [];

  return {
    totalGames: asNumber(gameStats.totalGames) ?? 0,
    wins: asNumber(gameStats.wins) ?? 0,
    winRate: asNumber(gameStats.winRate) ?? 0,
    avgQuestions: asNumber(gameStats.avgQuestions) ?? 0,
    avgPoolSize: asNumber(gameStats.avgPoolSize) ?? 0,
    byDifficulty,
    recentGames
  };
}

function parseHistoryGames(payload: unknown): MobileHistoryGame[] {
  if (!isRecord(payload) || !Array.isArray(payload.games)) {
    throw new MobileApiError('Invalid history response payload', 'validation');
  }

  return payload.games
    .map((entry): MobileHistoryGame | null => {
      if (!isRecord(entry)) {
        return null;
      }

      const id = asString(entry.id);
      const characterId = asString(entry.characterId);
      const characterName = asString(entry.characterName);
      const won = entry.won;
      const difficulty = asString(entry.difficulty);
      const questionsAsked = asNumber(entry.questionsAsked);
      const poolSize = asNumber(entry.poolSize);
      const timestamp = asNumber(entry.timestamp);

      if (
        id === null ||
        characterId === null ||
        characterName === null ||
        typeof won !== 'boolean' ||
        difficulty === null ||
        questionsAsked === null ||
        poolSize === null ||
        timestamp === null
      ) {
        return null;
      }

      return {
        id,
        characterId,
        characterName,
        won,
        difficulty,
        questionsAsked,
        poolSize,
        timestamp
      };
    })
    .filter((entry): entry is MobileHistoryGame => entry !== null);
}

export async function startGame(input: StartGameInput): Promise<MobileStartResponse> {
  const payload = await postJson(ENDPOINTS.start, {
    categories: input.categories.length ? input.categories : undefined,
    difficulty: input.difficulty,
    characterId: input.characterId
  });

  if (!isRecord(payload) || typeof payload.sessionId !== 'string') {
    throw new MobileApiError('Invalid start response payload', 'validation');
  }

  return {
    sessionId: payload.sessionId,
    question: parseQuestion(payload.question),
    reasoning: parseReasoning(payload.reasoning)
  };
}

export async function submitAnswer(
  sessionId: string,
  value: AnswerValue
): Promise<MobileAnswerResponse> {
  const payload = await postJson(ENDPOINTS.answer, {
    sessionId,
    value
  });

  if (!isRecord(payload) || typeof payload.type !== 'string') {
    throw new MobileApiError('Invalid answer response payload', 'validation');
  }

  return parseAnswerPayload(payload);
}

function parseAnswerPayload(payload: Record<string, unknown>): MobileAnswerResponse {
  if (payload.type === 'question') {
    return {
      type: 'question',
      question: parseQuestion(payload.question),
      reasoning: parseReasoning(payload.reasoning),
      remaining: typeof payload.remaining === 'number' ? payload.remaining : undefined
    };
  }

  if (payload.type === 'guess') {
    return {
      type: 'guess',
      character: parseGuess(payload.character),
      confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
      remaining: typeof payload.remaining === 'number' ? payload.remaining : undefined
    };
  }

  if (payload.type === 'contradiction') {
    return {
      type: 'contradiction',
      message: typeof payload.message === 'string' ? payload.message : undefined,
      question: payload.question ? parseQuestion(payload.question) : undefined,
      reasoning: payload.reasoning ? parseReasoning(payload.reasoning) : undefined
    };
  }

  throw new MobileApiError('Unknown answer response type', 'validation');
}

export async function skipQuestion(sessionId: string): Promise<MobileSkipResponse | null> {
  const response = await postRaw(ENDPOINTS.skip, { sessionId });
  if (response.status === 409) {
    return null;
  }

  if (!response.ok) {
    throw new MobileApiError(`Skip request failed (${response.status})`, 'server', response.status);
  }

  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || payload.type !== 'question') {
    throw new MobileApiError('Invalid skip response payload', 'validation');
  }

  const remaining = payload.remaining;
  const questionCount = payload.questionCount;
  const skippedCount = payload.skippedCount;
  if (
    typeof remaining !== 'number' ||
    typeof questionCount !== 'number' ||
    typeof skippedCount !== 'number'
  ) {
    throw new MobileApiError('Skip counters are malformed', 'validation');
  }

  return {
    type: 'question',
    question: parseQuestion(payload.question),
    reasoning: parseReasoning(payload.reasoning),
    remaining,
    questionCount,
    skippedCount
  };
}

export async function rejectGuess(
  sessionId: string,
  characterId: string
): Promise<MobileRejectGuessResponse> {
  const payload = await postJson(ENDPOINTS.rejectGuess, {
    sessionId,
    characterId
  });

  if (!isRecord(payload) || typeof payload.type !== 'string') {
    throw new MobileApiError('Invalid reject response payload', 'validation');
  }

  if (payload.type === 'exhausted') {
    return {
      type: 'exhausted',
      message: typeof payload.message === 'string' ? payload.message : undefined
    };
  }

  if (payload.type === 'question') {
    return {
      type: 'question',
      question: parseQuestion(payload.question),
      reasoning: parseReasoning(payload.reasoning),
      rejectCooldownRemaining:
        typeof payload.rejectCooldownRemaining === 'number'
          ? payload.rejectCooldownRemaining
          : undefined,
      guessCount: typeof payload.guessCount === 'number' ? payload.guessCount : undefined
    };
  }

  throw new MobileApiError('Unknown reject response type', 'validation');
}

async function sendResult(sessionId: string, correct: boolean): Promise<void> {
  const response = await postRaw(ENDPOINTS.result, { sessionId, correct });
  if (!response.ok) {
    throw new MobileApiError(`Result request failed (${response.status})`, 'server', response.status);
  }
}

export async function submitResult(sessionId: string, correct: boolean): Promise<void> {
  try {
    await sendResult(sessionId, correct);
  } catch (error) {
    if (error instanceof MobileApiError && error.kind === 'transport') {
      await enqueueMobileQueuedResultAction({ sessionId, correct });
      return;
    }

    throw error;
  }
}

export async function resumeGame(sessionId: string): Promise<MobileResumeResponse | null> {
  const payload = await postJson(ENDPOINTS.resume, { sessionId });
  if (!isRecord(payload)) {
    throw new MobileApiError('Invalid resume response payload', 'validation');
  }

  if (payload.expired === true) {
    return null;
  }

  const guessCount = payload.guessCount;
  return {
    question: parseQuestion(payload.question),
    reasoning: parseReasoning(payload.reasoning),
    guessCount: typeof guessCount === 'number' ? guessCount : 0
  };
}

export async function fetchStatsOverview(): Promise<MobileStatsOverview> {
  const payload = await getJson(ENDPOINTS.stats);
  return parseStatsOverview(payload);
}

export async function fetchHistoryGames(limit = 50): Promise<MobileHistoryGame[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const payload = await getJson(`${ENDPOINTS.history}?limit=${safeLimit}`);
  return parseHistoryGames(payload);
}

export async function submitFeedback(
  sessionId: string,
  rating: number,
  feedbackText?: string
): Promise<void> {
  const cleanFeedbackText = feedbackText?.trim() || '';

  try {
    await sendFeedback(sessionId, rating, cleanFeedbackText);
  } catch (error) {
    if (error instanceof MobileApiError && error.kind === 'transport') {
      await enqueueMobileQueuedFeedbackAction({
        sessionId,
        rating,
        feedbackText: cleanFeedbackText
      });
      return;
    }

    throw error;
  }
}

export async function flushMobileQueuedActions(): Promise<number> {
  const queuedActions = await drainMobileQueuedActions();
  if (!queuedActions.length) {
    return 0;
  }

  let flushedCount = 0;

  for (let index = 0; index < queuedActions.length; index += 1) {
    const action = queuedActions[index];
    try {
      if (action.kind === 'result') {
        await sendResult(action.sessionId, action.correct);
      } else {
        await sendFeedback(action.sessionId, action.rating, action.feedbackText);
      }
      flushedCount += 1;
    } catch {
      await replaceMobileQueuedActions(queuedActions.slice(index));
      break;
    }
  }

  return flushedCount;
}

export { getMobileQueuedActionCount, onMobileQueuedActionCountChange };

async function sendFeedback(sessionId: string, rating: number, feedbackText: string): Promise<void> {
  const payload = await postJson(ENDPOINTS.feedback, {
    sessionId,
    rating,
    feedbackText: feedbackText || undefined
  });

  if (!isRecord(payload) || payload.success !== true) {
    throw new MobileApiError('Feedback response payload is malformed', 'validation');
  }
}

// ─── Daily Challenge ───────────────────────────────────────────────────────

export interface MobileFeaturedCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface MobileDailyResult {
  won: boolean;
  questionsAsked: number;
  completedAt: number;
}

export interface MobileDailyChallenge {
  date: string;
  characterId: string;
  featuredCharacter: MobileFeaturedCharacter;
  completed: boolean;
  result: MobileDailyResult | null;
  revealedCharacter: MobileFeaturedCharacter | null;
}

export interface MobileLeaderboardEntry {
  rank: number;
  userLabel: string;
  won: boolean;
  questionsAsked: number;
  completedAt: number;
  isYou: boolean;
}

export interface MobileDailyLeaderboard {
  date: string;
  leaderboard: MobileLeaderboardEntry[];
}

function parseFeaturedCharacter(raw: unknown): MobileFeaturedCharacter | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (id === null || name === null) return null;
  const imageUrl = asString(raw.imageUrl) ?? asString(raw.image_url) ?? null;
  return { id, name, imageUrl };
}

function parseDailyResult(raw: unknown): MobileDailyResult | null {
  if (!isRecord(raw)) return null;
  const won = typeof raw.won === 'boolean' ? raw.won : null;
  const questionsAsked = typeof raw.questionsAsked === 'number' ? raw.questionsAsked : null;
  const completedAt = typeof raw.completedAt === 'number' ? raw.completedAt : null;
  if (won === null || questionsAsked === null || completedAt === null) return null;
  return { won, questionsAsked, completedAt };
}

function parseDailyChallenge(raw: unknown): MobileDailyChallenge {
  if (!isRecord(raw)) {
    throw new MobileApiError('Daily challenge response is not an object', 'validation');
  }
  const date = asString(raw.date) ?? '';
  const characterId = asString(raw.characterId) ?? '';
  const featuredCharacter = parseFeaturedCharacter(raw.featuredCharacter);
  if (!featuredCharacter) {
    throw new MobileApiError('Daily challenge missing featuredCharacter', 'validation');
  }
  const completed = raw.completed === true;
  const result = parseDailyResult(raw.result);
  const revealedCharacter = completed ? parseFeaturedCharacter(raw.revealedCharacter) : null;
  return { date, characterId, featuredCharacter, completed, result, revealedCharacter };
}

function parseLeaderboardEntry(raw: unknown, idx: number): MobileLeaderboardEntry | null {
  if (!isRecord(raw)) return null;
  const rank = typeof raw.rank === 'number' ? raw.rank : idx + 1;
  const userLabel = asString(raw.userLabel) ?? `#${rank}`;
  const won = typeof raw.won === 'boolean' ? raw.won : false;
  const questionsAsked = typeof raw.questionsAsked === 'number' ? raw.questionsAsked : 0;
  const completedAt = typeof raw.completedAt === 'number' ? raw.completedAt : 0;
  const isYou = raw.isYou === true;
  return { rank, userLabel, won, questionsAsked, completedAt, isYou };
}

function parseDailyLeaderboard(raw: unknown): MobileDailyLeaderboard {
  if (!isRecord(raw)) {
    throw new MobileApiError('Leaderboard response is not an object', 'validation');
  }
  const date = asString(raw.date) ?? '';
  const rows = Array.isArray(raw.leaderboard)
    ? raw.leaderboard
        .map((entry, idx) => parseLeaderboardEntry(entry, idx))
        .filter((e): e is MobileLeaderboardEntry => e !== null)
        .slice(0, 10)
    : [];
  return { date, leaderboard: rows };
}

export async function fetchDailyChallenge(): Promise<MobileDailyChallenge> {
  const payload = await getJson(ENDPOINTS.daily);
  return parseDailyChallenge(payload);
}

export async function fetchDailyLeaderboard(date?: string): Promise<MobileDailyLeaderboard> {
  const url = date ? `${ENDPOINTS.dailyLeaderboard}?date=${encodeURIComponent(date)}` : ENDPOINTS.dailyLeaderboard;
  const payload = await getJson(url);
  return parseDailyLeaderboard(payload);
}
