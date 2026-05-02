import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  jsonResponseMock,
  errorResponseMock,
  parseJsonBodyWithSchemaMock,
  isValidCategoryMock,
  d1QueryMock,
  d1FirstMock,
  d1RunMock,
  getOrCreateUserIdMock,
  withSetCookieMock,
  logErrorMock,
  selectBestQuestionMock,
  generateReasoningMock,
  storeSessionMock,
  loadCachedQuestionsMock,
  storeCachedQuestionsMock,
  parseAttrsJsonMock,
  rephraseQuestionWithCacheMock,
  assignVariantMock,
} = vi.hoisted(() => ({
  jsonResponseMock: vi.fn((data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status }),
  ),
  errorResponseMock: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), { status }),
  ),
  parseJsonBodyWithSchemaMock: vi.fn(),
  isValidCategoryMock: vi.fn(),
  d1QueryMock: vi.fn(),
  d1FirstMock: vi.fn(),
  d1RunMock: vi.fn(),
  getOrCreateUserIdMock: vi.fn(),
  withSetCookieMock: vi.fn((response: Response) => response),
  logErrorMock: vi.fn().mockResolvedValue(undefined),
  selectBestQuestionMock: vi.fn(),
  generateReasoningMock: vi.fn(),
  storeSessionMock: vi.fn().mockResolvedValue(undefined),
  loadCachedQuestionsMock: vi.fn(),
  storeCachedQuestionsMock: vi.fn().mockResolvedValue(undefined),
  parseAttrsJsonMock: vi.fn(),
  rephraseQuestionWithCacheMock: vi.fn(),
  assignVariantMock: vi.fn(),
}));

vi.mock('../../_helpers', () => ({
  jsonResponse: jsonResponseMock,
  errorResponse: errorResponseMock,
  parseJsonBodyWithSchema: parseJsonBodyWithSchemaMock,
  isValidCategory: isValidCategoryMock,
  d1Query: d1QueryMock,
  d1First: d1FirstMock,
  d1Run: d1RunMock,
  getOrCreateUserId: getOrCreateUserIdMock,
  withSetCookie: withSetCookieMock,
  logError: logErrorMock,
}));

vi.mock('../_game-engine', () => ({
  selectBestQuestion: selectBestQuestionMock,
  generateReasoning: generateReasoningMock,
  storeSession: storeSessionMock,
  loadCachedQuestions: loadCachedQuestionsMock,
  storeCachedQuestions: storeCachedQuestionsMock,
  parseAttrsJson: parseAttrsJsonMock,
  POOL_SIZE: 500,
  MIN_ATTRIBUTES: 20,
  DIFFICULTY_MAP: { easy: 20, medium: 15, hard: 10 },
}));

vi.mock('../_llm-rephrase', () => ({
  rephraseQuestionWithCache: rephraseQuestionWithCacheMock,
}));

vi.mock('../_ab', () => ({
  assignVariant: assignVariantMock,
}));

import { onRequestPost } from './start';

const CHARACTER_ROW = {
  id: 'mario',
  name: 'Mario',
  category: 'video-games',
  image_url: null,
  popularity: 100,
  attributes_json: '{"isHuman":1}',
  trivia: null,
};

const FIRST_QUESTION = {
  id: 'q1',
  text: 'Is this character human?',
  attribute: 'isHuman',
};

const REASONING = {
  why: 'best split',
  impact: 'high',
  remaining: 100,
  confidence: 20,
  topCandidates: [],
};

function makeContext(body: unknown, opts: { kv?: unknown; db?: unknown } = {}) {
  return {
    env: {
      GUESS_KV: 'kv' in opts ? opts.kv : {},
      GUESS_DB: 'db' in opts ? opts.db : {},
    },
    request: new Request('https://example.com/api/v2/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    waitUntil: vi.fn(),
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe('POST /api/v2/game/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    parseJsonBodyWithSchemaMock.mockResolvedValue({
      success: true,
      data: { categories: ['video-games'], difficulty: 'medium' },
    });
    isValidCategoryMock.mockReturnValue(true);

    d1QueryMock.mockImplementation((_, query: string) => {
      if (query.includes('FROM characters')) {
        return Promise.resolve([CHARACTER_ROW, { ...CHARACTER_ROW, id: 'link', name: 'Link' }]);
      }
      if (query.includes('FROM questions')) {
        return Promise.resolve([{ id: 'q1', text: FIRST_QUESTION.text, attribute_key: FIRST_QUESTION.attribute }]);
      }
      return Promise.resolve([]);
    });

    loadCachedQuestionsMock.mockResolvedValue(null);
    parseAttrsJsonMock.mockReturnValue({ isHuman: true });
    selectBestQuestionMock.mockReturnValue(FIRST_QUESTION);
    generateReasoningMock.mockReturnValue(REASONING);
    rephraseQuestionWithCacheMock.mockResolvedValue(null);
    getOrCreateUserIdMock.mockResolvedValue({ userId: 'u-1', setCookieHeader: undefined });
    assignVariantMock.mockResolvedValue({ variant: 'control', selector: 'greedy' });
    d1RunMock.mockResolvedValue(undefined);
  });

  it('returns 503 when D1 or KV binding is missing', async () => {
    const ctx = makeContext({ categories: [], difficulty: 'medium' }, { kv: null, db: {} });

    await onRequestPost(ctx);

    expect(errorResponseMock).toHaveBeenCalledWith('D1/KV not configured', 503);
  });

  it('returns parser response when schema validation fails', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      success: false,
      response: new Response('bad', { status: 400 }),
    });

    const ctx = makeContext({ difficulty: 'medium' });
    const response = await onRequestPost(ctx);

    expect(response.status).toBe(400);
  });

  it('returns 400 when fewer than two characters are available', async () => {
    d1QueryMock.mockImplementation((_, query: string) => {
      if (query.includes('FROM characters')) {
        return Promise.resolve([CHARACTER_ROW]);
      }
      if (query.includes('FROM questions')) {
        return Promise.resolve([{ id: 'q1', text: FIRST_QUESTION.text, attribute_key: FIRST_QUESTION.attribute }]);
      }
      return Promise.resolve([]);
    });

    const ctx = makeContext({ categories: ['video-games'], difficulty: 'medium' });

    await onRequestPost(ctx);

    expect(errorResponseMock).toHaveBeenCalledWith(
      'Not enough characters with attribute data for selected categories',
      400,
    );
  });

  it('returns 500 when no question is selectable', async () => {
    selectBestQuestionMock.mockReturnValue(null);

    const ctx = makeContext({ categories: ['video-games'], difficulty: 'medium' });

    await onRequestPost(ctx);

    expect(errorResponseMock).toHaveBeenCalledWith('No questions available', 500);
  });

  it('creates session and returns start payload on success', async () => {
    const ctx = makeContext({ categories: ['video-games'], difficulty: 'medium' });

    const response = await onRequestPost(ctx);

    expect(response.status).toBe(200);
    expect(storeSessionMock).toHaveBeenCalled();
    expect(assignVariantMock).toHaveBeenCalledWith(ctx.env.GUESS_KV, 'u-1');
    expect(withSetCookieMock).toHaveBeenCalled();
    expect(jsonResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: FIRST_QUESTION,
        reasoning: REASONING,
        totalCharacters: 2,
      }),
    );
  });
});
