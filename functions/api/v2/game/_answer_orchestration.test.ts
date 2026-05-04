import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  jsonResponseMock,
  errorResponseMock,
  loadAdaptiveDataMock,
  detectContradictionsMock,
  evaluateGuessReadinessMock,
  rollbackAndBuildContradictionResponseMock,
  finalizeBestGuessForSessionMock,
  selectNextQuestionForTurnMock,
  getRecentQuestionCategoriesMock,
  buildNextQuestionResponseMock,
  persistAndSyncAnswerTurnMock,
  applyRejectCooldownMock,
} = vi.hoisted(() => ({
  jsonResponseMock: vi.fn(
    (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status }),
  ),
  errorResponseMock: vi.fn(
    (message: string, status: number) =>
      new Response(JSON.stringify({ error: message }), { status }),
  ),
  loadAdaptiveDataMock: vi.fn(),
  detectContradictionsMock: vi.fn(),
  evaluateGuessReadinessMock: vi.fn(),
  rollbackAndBuildContradictionResponseMock: vi.fn(),
  finalizeBestGuessForSessionMock: vi.fn(),
  selectNextQuestionForTurnMock: vi.fn(),
  getRecentQuestionCategoriesMock: vi.fn(),
  buildNextQuestionResponseMock: vi.fn(),
  persistAndSyncAnswerTurnMock: vi.fn(),
  applyRejectCooldownMock: vi.fn(),
}))

vi.mock('../../_helpers', () => ({
  jsonResponse: jsonResponseMock,
  errorResponse: errorResponseMock,
}))

vi.mock('../_game-engine', () => ({
  loadAdaptiveData: loadAdaptiveDataMock,
  detectContradictions: detectContradictionsMock,
  evaluateGuessReadiness: evaluateGuessReadinessMock,
}))

vi.mock('./_contradiction', () => ({
  rollbackAndBuildContradictionResponse: rollbackAndBuildContradictionResponseMock,
}))

vi.mock('./_guess-flow', () => ({
  finalizeBestGuessForSession: finalizeBestGuessForSessionMock,
}))

vi.mock('./_question-selection', () => ({
  selectNextQuestionForTurn: selectNextQuestionForTurnMock,
  getRecentQuestionCategories: getRecentQuestionCategoriesMock,
}))

vi.mock('./_question-flow', () => ({
  buildNextQuestionResponse: buildNextQuestionResponseMock,
  persistAndSyncAnswerTurn: persistAndSyncAnswerTurnMock,
}))

vi.mock('./_readiness', () => ({
  applyRejectCooldown: applyRejectCooldownMock,
}))

import {
  prefetchAdaptiveData,
  maybeHandleContradiction,
  computeResponseReadiness,
  maybeFinalizeReadinessGuess,
  continueWithNextQuestion,
} from './_answer_orchestration'

const BASE_SESSION = {
  id: 'sess-1',
  answers: [{ questionId: 'isHuman', value: 'yes' }],
  maxQuestions: 15,
  guessCount: 0,
  questions: [{ id: 'q1', text: 'Is human?', attribute: 'isHuman' }],
  selector: 'mcts',
}

describe('_answer_orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRecentQuestionCategoriesMock.mockReturnValue([])
    applyRejectCooldownMock.mockImplementation((_session, readiness) => readiness)
  })

  it('prefetchAdaptiveData returns empty adaptive data when load fails', async () => {
    loadAdaptiveDataMock.mockRejectedValue(new Error('kv unavailable'))

    const adaptive = await prefetchAdaptiveData({} as KVNamespace, undefined)

    expect(loadAdaptiveDataMock).toHaveBeenCalledOnce()
    expect(adaptive).toEqual(expect.objectContaining({
      maybeRateMap: undefined,
      netGainMap: undefined,
      confusionDiscriminators: undefined,
      questionEmpiricalGainMap: undefined,
      questionQualityPenaltyMap: undefined,
    }))
  })

  it('maybeHandleContradiction returns null when no contradiction exists', async () => {
    detectContradictionsMock.mockReturnValue({ hasContradiction: false })

    const response = await maybeHandleContradiction({
      kv: {} as KVNamespace,
      session: BASE_SESSION as never,
      filtered: [] as never,
    })

    expect(response).toBeNull()
    expect(rollbackAndBuildContradictionResponseMock).not.toHaveBeenCalled()
  })

  it('maybeHandleContradiction returns rollback response when contradiction exists', async () => {
    detectContradictionsMock.mockReturnValue({ hasContradiction: true })
    rollbackAndBuildContradictionResponseMock.mockResolvedValue({ type: 'contradiction' })

    const response = await maybeHandleContradiction({
      kv: {} as KVNamespace,
      session: BASE_SESSION as never,
      filtered: [] as never,
    })

    expect(rollbackAndBuildContradictionResponseMock).toHaveBeenCalledWith({
      kv: expect.any(Object),
      session: BASE_SESSION,
    })
    expect(jsonResponseMock).toHaveBeenCalledWith({ type: 'contradiction' })
    expect(response).toBeInstanceOf(Response)
  })

  it('computeResponseReadiness evaluates readiness and applies cooldown', () => {
    const readiness = { shouldGuess: true, blockedByRejectCooldown: false }
    const cooled = { shouldGuess: false, blockedByRejectCooldown: true }
    evaluateGuessReadinessMock.mockReturnValue(readiness)
    applyRejectCooldownMock.mockReturnValue(cooled)

    const result = computeResponseReadiness({
      session: BASE_SESSION as never,
      filtered: [] as never,
      scoring: {} as never,
      probs: {} as never,
    })

    expect(evaluateGuessReadinessMock).toHaveBeenCalledWith(
      [],
      BASE_SESSION.answers,
      1,
      BASE_SESSION.maxQuestions,
      BASE_SESSION.guessCount,
      {},
      {},
    )
    expect(applyRejectCooldownMock).toHaveBeenCalledWith(BASE_SESSION, readiness)
    expect(result).toBe(cooled)
  })

  it('maybeFinalizeReadinessGuess finalizes when readiness allows guessing', async () => {
    finalizeBestGuessForSessionMock.mockResolvedValue({ type: 'guess', id: 'mario' })

    const response = await maybeFinalizeReadinessGuess({
      kv: {} as KVNamespace,
      session: BASE_SESSION as never,
      filtered: [] as never,
      scoring: {} as never,
      questionCount: 2,
      remaining: 1,
      readiness: { shouldGuess: true, blockedByRejectCooldown: false },
    })

    expect(finalizeBestGuessForSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      recordAnalytics: true,
      readiness: { shouldGuess: true, blockedByRejectCooldown: false },
    }))
    expect(jsonResponseMock).toHaveBeenCalledWith({ type: 'guess', id: 'mario' })
    expect(response).toBeInstanceOf(Response)
  })

  it('continueWithNextQuestion returns error when no next question and no fallback guess', async () => {
    selectNextQuestionForTurnMock.mockReturnValue(null)
    finalizeBestGuessForSessionMock.mockResolvedValue(null)

    const response = await continueWithNextQuestion({
      env: {} as never,
      waitUntil: vi.fn(),
      kv: {} as KVNamespace,
      db: null,
      session: BASE_SESSION as never,
      filtered: [] as never,
      scoring: {} as never,
      adaptive: {} as never,
      probs: {} as never,
      questionCount: 2,
      readiness: {} as never,
    })

    expect(errorResponseMock).toHaveBeenCalledWith('No questions or candidates available', 500)
    expect(response.status).toBe(500)
  })

  it('continueWithNextQuestion persists and returns question response when next question exists', async () => {
    const nextQuestion = { id: 'q2', text: 'Can fly?', attribute: 'canFly' }
    const responsePayload = { type: 'question', question: nextQuestion }
    const reasoning = { why: 'split', impact: 'gain', remaining: 2, confidence: 60, topCandidates: [] }
    selectNextQuestionForTurnMock.mockReturnValue(nextQuestion)
    buildNextQuestionResponseMock.mockReturnValue({ reasoning, response: responsePayload })
    persistAndSyncAnswerTurnMock.mockResolvedValue(undefined)

    const response = await continueWithNextQuestion({
      env: {} as never,
      waitUntil: vi.fn(),
      kv: {} as KVNamespace,
      db: {} as D1Database,
      session: BASE_SESSION as never,
      filtered: [] as never,
      scoring: {} as never,
      adaptive: {} as never,
      probs: {} as never,
      questionCount: 2,
      readiness: {} as never,
    })

    expect(buildNextQuestionResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      nextQuestion,
      questionCount: 2,
    }))
    expect(persistAndSyncAnswerTurnMock).toHaveBeenCalledOnce()
    expect(jsonResponseMock).toHaveBeenCalledWith(responsePayload)
    expect(response).toBeInstanceOf(Response)
  })
})