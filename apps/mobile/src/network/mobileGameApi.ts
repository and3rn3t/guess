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

const ENDPOINTS = {
  start: '/api/v2/game/start',
  answer: '/api/v2/game/answer',
  skip: '/api/v2/game/skip',
  rejectGuess: '/api/v2/game/reject-guess',
  result: '/api/v2/game/result',
  resume: '/api/v2/game/resume'
} as const;

const DEFAULT_TIMEOUT_MS = 10_000;

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
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
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
    const preview = (await response.text()).slice(0, 140).replace(/\s+/g, ' ').trim();
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(toUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
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

export async function submitResult(sessionId: string, correct: boolean): Promise<void> {
  const response = await postRaw(ENDPOINTS.result, { sessionId, correct });
  if (!response.ok) {
    throw new MobileApiError(`Result request failed (${response.status})`, 'server', response.status);
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
