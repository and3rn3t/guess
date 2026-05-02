import { describe, expect, it } from 'vitest'
import type { GameSession, ServerCharacter } from '../_game-engine'
import { updatePosteriorHistory } from './_posterior-history'

function makeSession(): GameSession {
  return {
    id: 'sess-1',
    characters: [],
    questions: [],
    answers: [],
    currentQuestion: null,
    difficulty: 'medium',
    maxQuestions: 15,
    createdAt: Date.now(),
    rejectedGuesses: [],
    skippedQuestions: [],
    guessCount: 0,
    postRejectCooldown: 0,
  }
}

describe('updatePosteriorHistory', () => {
  it('initializes tracking arrays and appends top probability and top-10', () => {
    const session = makeSession()
    const filtered: ServerCharacter[] = [
      { id: 'a', name: 'Alpha', category: 'test', imageUrl: null, attributes: {} },
      { id: 'b', name: 'Beta', category: 'test', imageUrl: null, attributes: {} },
    ]
    const probs = new Map<string, number>([
      ['b', 0.9],
      ['a', 0.1],
    ])

    updatePosteriorHistory(session, probs, filtered)

    expect(session.posteriorHistory).toEqual([0.9])
    expect(session.stepTopTen).toEqual([[{ id: 'b', name: 'Beta' }, { id: 'a', name: 'Alpha' }]])
  })

  it('uses id as fallback name and handles empty probabilities', () => {
    const session = makeSession()
    const filtered: ServerCharacter[] = [
      { id: 'a', name: 'Alpha', category: 'test', imageUrl: null, attributes: {} },
    ]
    const probs = new Map<string, number>([['unknown-id', 0.2]])

    updatePosteriorHistory(session, probs, filtered)

    expect(session.posteriorHistory).toEqual([0.2])
    expect(session.stepTopTen).toEqual([[{ id: 'unknown-id', name: 'unknown-id' }]])

    updatePosteriorHistory(session, new Map(), filtered)

    expect(session.posteriorHistory).toEqual([0.2, 0])
    expect(session.stepTopTen?.[1]).toEqual([])
  })
})
