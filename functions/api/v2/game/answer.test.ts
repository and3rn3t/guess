import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  d1RunMock,
  errorResponseMock,
  jsonResponseMock,
  parseJsonBodyWithSchemaMock,
  logErrorMock,
  loadSessionMock,
  saveSessionStateMock,
  filterPossibleCharactersMock,
  detectContradictionsMock,
  evaluateGuessReadinessMock,
  getBestGuessResultMock,
  selectBestQuestionMock,
  generateReasoningMock,
  calculateProbabilitiesMock,
  loadAdaptiveDataMock,
  getOrBuildCoverageMapMock,
  buildQuestionOptionsMock,
  rephraseQuestionMock,
} = vi.hoisted(() => ({
  d1RunMock: vi.fn(),
  errorResponseMock: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), { status }),
  ),
  jsonResponseMock: vi.fn((data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status }),
  ),
  parseJsonBodyWithSchemaMock: vi.fn(),
  logErrorMock: vi.fn().mockResolvedValue(undefined),
  loadSessionMock: vi.fn(),
  saveSessionStateMock: vi.fn().mockResolvedValue(undefined),
  filterPossibleCharactersMock: vi.fn(),
  detectContradictionsMock: vi.fn(),
  evaluateGuessReadinessMock: vi.fn(),
  getBestGuessResultMock: vi.fn(),
  selectBestQuestionMock: vi.fn(),
  generateReasoningMock: vi.fn(),
  calculateProbabilitiesMock: vi.fn(),
  loadAdaptiveDataMock: vi.fn().mockResolvedValue(null),
  getOrBuildCoverageMapMock: vi.fn().mockReturnValue(new Map()),
  buildQuestionOptionsMock: vi.fn().mockReturnValue({}),
  rephraseQuestionMock: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../_helpers', () => ({
  d1Run: d1RunMock,
  errorResponse: errorResponseMock,
  jsonResponse: jsonResponseMock,
  parseJsonBodyWithSchema: parseJsonBodyWithSchemaMock,
  logError: logErrorMock,
}))

vi.mock('../_game-engine', () => ({
  filterPossibleCharacters: filterPossibleCharactersMock,
  detectContradictions: detectContradictionsMock,
  evaluateGuessReadiness: evaluateGuessReadinessMock,
  getBestGuessResult: getBestGuessResultMock,
  selectBestQuestion: selectBestQuestionMock,
  generateReasoning: generateReasoningMock,
  calculateProbabilities: calculateProbabilitiesMock,
  loadSession: loadSessionMock,
  saveSessionState: saveSessionStateMock,
  loadAdaptiveData: loadAdaptiveDataMock,
  getOrBuildCoverageMap: getOrBuildCoverageMapMock,
  buildQuestionOptions: buildQuestionOptionsMock,
}))

vi.mock('../_llm-rephrase', () => ({
  rephraseQuestion: rephraseQuestionMock,
}))

import { onRequestPost } from './answer'

// ── Fixtures ──────────────────────────────────────────────────

const SESSION = {
  id: 'sess-1',
  characters: [
    { id: 'mario', name: 'Mario', category: 'games', imageUrl: null, attributes: { isHuman: true } },
    { id: 'pikachu', name: 'Pikachu', category: 'games', imageUrl: null, attributes: { isHuman: false } },
  ],
  questions: [
    { id: 'q1', text: 'Is this character human?', attribute: 'isHuman', category: 'traits' },
    { id: 'q2', text: 'Can they fly?', attribute: 'canFly', category: 'abilities' },
  ],
  answers: [],
  currentQuestion: { id: 'q1', attribute: 'isHuman', text: 'Is this character human?', category: 'traits' },
  difficulty: 'medium',
  maxQuestions: 15,
  guessCount: 0,
  rejectedGuesses: [],
  skippedQuestions: [],
  postRejectCooldown: 0,
  persona: 'watson',
  popularityMap: new Map(),
  createdAt: Date.now(),
  guessAnalytics: null,
}

const NEXT_QUESTION = { id: 'q2', attribute: 'canFly', text: 'Can they fly?', category: 'abilities' }
const REASONING = { why: 'splits evenly', impact: 'eliminates half', remaining: 2, confidence: 60, topCandidates: [] }
const READINESS = {
  shouldGuess: false, forced: false, trigger: null, gap: 0.1, aliveCount: 2, questionsRemaining: 14,
  blockedByRejectCooldown: false, rejectCooldownRemaining: 0,
}

function makeCtx(body: unknown, opts: { kv?: unknown; db?: unknown } = {}) {
  return {
    env: {
      GUESS_KV: 'kv' in opts ? opts.kv : {},
      GUESS_DB: 'db' in opts ? opts.db : null,
    },
    request: new Request('https://example.com/api/v2/game/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    waitUntil: vi.fn(),
  } as unknown as Parameters<typeof onRequestPost>[0]
}

// ── Tests ─────────────────────────────────────────────────────

describe('POST /api/v2/game/answer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveSessionStateMock.mockResolvedValue(undefined)
    loadAdaptiveDataMock.mockResolvedValue(null)
    getOrBuildCoverageMapMock.mockReturnValue(new Map())
    buildQuestionOptionsMock.mockReturnValue({})
    rephraseQuestionMock.mockResolvedValue(null)
    logErrorMock.mockResolvedValue(undefined)
  })

  it('returns 503 when KV is not configured', async () => {
    const ctx = makeCtx({ sessionId: 'x', value: 'yes' }, { kv: null })
    await onRequestPost(ctx)
    expect(errorResponseMock).toHaveBeenCalledWith('KV not configured', 503)
  })

  it('returns 400 on schema validation failure', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      success: false,
      response: new Response('bad', { status: 400 }),
    })
    const ctx = makeCtx({ sessionId: 'x' })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 404 when session not found', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({ success: true, data: { sessionId: 'x', value: 'yes' } })
    loadSessionMock.mockResolvedValue(null)
    const ctx = makeCtx({ sessionId: 'x', value: 'yes' })
    await onRequestPost(ctx)
    expect(errorResponseMock).toHaveBeenCalledWith('Session not found or expired', 404)
  })

  it('returns 400 when no current question', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({ success: true, data: { sessionId: 'x', value: 'yes' } })
    loadSessionMock.mockResolvedValue({ ...SESSION, currentQuestion: null })
    const ctx = makeCtx({ sessionId: 'x', value: 'yes' })
    await onRequestPost(ctx)
    expect(errorResponseMock).toHaveBeenCalledWith('No pending question to answer', 400)
  })

  it('returns contradiction response when detectContradictions fires', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({ success: true, data: { sessionId: 'x', value: 'yes' } })
    loadSessionMock.mockResolvedValue({ ...SESSION, answers: [] })
    filterPossibleCharactersMock.mockReturnValue(SESSION.characters)
    calculateProbabilitiesMock.mockReturnValue(new Map())
    detectContradictionsMock.mockReturnValue({ hasContradiction: true, remainingCount: 0 })
    generateReasoningMock.mockReturnValue(REASONING)
    const ctx = makeCtx({ sessionId: 'x', value: 'yes' })
    await onRequestPost(ctx)
    expect(jsonResponseMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'contradiction' }))
  })

  it('returns next question when readiness is false', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({ success: true, data: { sessionId: 'x', value: 'yes' } })
    loadSessionMock.mockResolvedValue({ ...SESSION })
    filterPossibleCharactersMock.mockReturnValue(SESSION.characters)
    calculateProbabilitiesMock.mockReturnValue(new Map([['mario', 0.8], ['pikachu', 0.2]]))
    detectContradictionsMock.mockReturnValue({ hasContradiction: false, remainingCount: 2 })
    evaluateGuessReadinessMock.mockReturnValue(READINESS)
    selectBestQuestionMock.mockReturnValue(NEXT_QUESTION)
    generateReasoningMock.mockReturnValue(REASONING)
    const ctx = makeCtx({ sessionId: 'x', value: 'yes' })
    await onRequestPost(ctx)
    expect(jsonResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'question', question: NEXT_QUESTION }),
    )
  })

  it('returns guess response when readiness triggers', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({ success: true, data: { sessionId: 'x', value: 'yes' } })
    loadSessionMock.mockResolvedValue({ ...SESSION })
    filterPossibleCharactersMock.mockReturnValue([SESSION.characters[0]])
    calculateProbabilitiesMock.mockReturnValue(new Map([['mario', 1.0]]))
    detectContradictionsMock.mockReturnValue({ hasContradiction: false, remainingCount: 1 })
    evaluateGuessReadinessMock.mockReturnValue({ ...READINESS, shouldGuess: true, forced: false })
    getBestGuessResultMock.mockReturnValue({
      character: SESSION.characters[0],
      probs: new Map([['mario', 0.95]]),
    })
    const ctx = makeCtx({ sessionId: 'x', value: 'yes' })
    await onRequestPost(ctx)
    expect(jsonResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'guess', character: expect.objectContaining({ id: 'mario' }) }),
    )
  })
})
