import { describe, expect, it } from 'vitest'
import type { GameSession, GuessReadiness } from '../_game-engine'
import { applyRejectCooldown } from './_readiness'

function makeSession(postRejectCooldown: number): GameSession {
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
    postRejectCooldown,
  }
}

function makeReadiness(partial: Partial<GuessReadiness> = {}): GuessReadiness {
  return {
    shouldGuess: false,
    trigger: null,
    topProbability: 0,
    gap: 0,
    aliveCount: 0,
    questionsRemaining: 0,
    forced: false,
    blockedByRejectCooldown: false,
    rejectCooldownRemaining: 0,
    ...partial,
  }
}

describe('applyRejectCooldown', () => {
  it('blocks guessing and decrements cooldown when active and not forced', () => {
    const session = makeSession(2)
    const response = applyRejectCooldown(session, makeReadiness({ forced: false }))

    expect(response.blockedByRejectCooldown).toBe(true)
    expect(response.rejectCooldownRemaining).toBe(1)
    expect(session.postRejectCooldown).toBe(1)
  })

  it('does not decrement cooldown when forced guess is true', () => {
    const session = makeSession(2)
    const response = applyRejectCooldown(session, makeReadiness({ forced: true }))

    expect(response.blockedByRejectCooldown).toBe(false)
    expect(response.rejectCooldownRemaining).toBe(2)
    expect(session.postRejectCooldown).toBe(2)
  })

  it('keeps cooldown at zero when already zero', () => {
    const session = makeSession(0)
    const response = applyRejectCooldown(session, makeReadiness())

    expect(response.blockedByRejectCooldown).toBe(false)
    expect(response.rejectCooldownRemaining).toBe(0)
    expect(session.postRejectCooldown).toBe(0)
  })
})
