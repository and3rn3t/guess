import { beforeEach, describe, expect, it, vi } from 'vitest'

const { filterPossibleCharactersMock } = vi.hoisted(() => ({
  filterPossibleCharactersMock: vi.fn(),
}))

vi.mock('../_game-engine', async () => {
  const actual = await vi.importActual<typeof import('../_game-engine')>('../_game-engine')
  return {
    ...actual,
    filterPossibleCharacters: filterPossibleCharactersMock,
  }
})

import { calculateEliminatedCount } from './_elimination'

describe('calculateEliminatedCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes eliminated candidates from previous filtered count', () => {
    const session = {
      characters: [],
      answers: [{ questionId: 'isHuman', value: 'yes' }],
      rejectedGuesses: [],
    }

    filterPossibleCharactersMock.mockReturnValue(new Array(10).fill(null))

    const eliminated = calculateEliminatedCount(session as never, 6)

    expect(eliminated).toBe(4)
  })

  it('returns zero when candidate count stays unchanged', () => {
    const session = {
      characters: [],
      answers: [{ questionId: 'isHuman', value: 'yes' }],
      rejectedGuesses: [],
    }

    filterPossibleCharactersMock.mockReturnValue(new Array(6).fill(null))

    const eliminated = calculateEliminatedCount(session as never, 6)

    expect(eliminated).toBe(0)
  })
})
