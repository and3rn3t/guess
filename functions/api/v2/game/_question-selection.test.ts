import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSession, ServerCharacter, ServerQuestion } from '../_game-engine'

const { buildQuestionOptionsMock, selectBestQuestionMock } = vi.hoisted(() => ({
  buildQuestionOptionsMock: vi.fn(),
  selectBestQuestionMock: vi.fn(),
}))

vi.mock('../_game-engine', async () => {
  const actual = await vi.importActual<typeof import('../_game-engine')>('../_game-engine')
  return {
    ...actual,
    buildQuestionOptions: buildQuestionOptionsMock,
    selectBestQuestion: selectBestQuestionMock,
  }
})

import {
  getRecentQuestionCategories,
  selectNextQuestionForTurn,
} from './_question-selection'

function makeSession(): GameSession {
  return {
    id: 'sess-1',
    characters: [],
    questions: [
      { id: 'q1', text: 'Is human?', attribute: 'isHuman', category: 'origin' },
      { id: 'q2', text: 'Can fly?', attribute: 'canFly', category: 'ability' },
      { id: 'q3', text: 'Uses magic?', attribute: 'usesMagic', category: 'power' },
      { id: 'q4', text: 'Wears armor?', attribute: 'wearsArmor', category: 'appearance' },
    ],
    answers: [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'no' },
      { questionId: 'usesMagic', value: 'maybe' },
      { questionId: 'wearsArmor', value: 'unknown' },
    ],
    currentQuestion: null,
    difficulty: 'medium',
    maxQuestions: 20,
    createdAt: Date.now(),
    rejectedGuesses: [],
    skippedQuestions: [],
    guessCount: 0,
    postRejectCooldown: 0,
  }
}

describe('question selection helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildQuestionOptionsMock.mockReturnValue({ options: true })
    selectBestQuestionMock.mockReturnValue(null)
  })

  it('returns recent categories from latest answered questions', () => {
    const categories = getRecentQuestionCategories(makeSession())
    expect(categories).toEqual(['ability', 'power', 'appearance'])
  })

  it('builds options with progress and forwards selector to selectBestQuestion', () => {
    const session = makeSession()
    const filtered: ServerCharacter[] = []
    const questions: ServerQuestion[] = session.questions
    const scoring = { coverageMap: new Map<string, number>(), popularityMap: undefined }
    const adaptive = {
      maybeRateMap: undefined,
      netGainMap: undefined,
      confusionDiscriminators: undefined,
      disputeMap: undefined,
      attributeTrustMap: undefined,
      characterPopularityMap: undefined,
      questionEmpiricalGainMap: undefined,
      questionQualityPenaltyMap: undefined,
      confusionPairs: undefined,
      activeWeights: undefined,
    }
    const probs = new Map<string, number>([['a', 0.7]])
    const recentCategories = ['power']

    selectNextQuestionForTurn({
      session,
      filtered,
      questions,
      scoring,
      adaptive,
      probs,
      recentCategories,
      selector: 'mcts',
    })

    expect(buildQuestionOptionsMock).toHaveBeenCalledWith(
      session,
      scoring,
      adaptive,
      { progress: 0.2, probs, recentCategories },
    )
    expect(selectBestQuestionMock).toHaveBeenCalledWith(
      filtered,
      session.answers,
      questions,
      { options: true },
      'mcts',
    )
  })
})
