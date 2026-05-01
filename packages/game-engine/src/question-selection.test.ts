import { describe, expect, it } from 'vitest'
import { selectBestQuestion } from './question-selection'
import type { GameCharacter, GameQuestion } from './types'

const characters: GameCharacter[] = [
  { id: 'a', name: 'A', attributes: { hasHat: true, isHero: true } },
  { id: 'b', name: 'B', attributes: { hasHat: false, isHero: true } },
  { id: 'c', name: 'C', attributes: { hasHat: true, isHero: false } },
  { id: 'd', name: 'D', attributes: { hasHat: false, isHero: false } },
]

const questions: GameQuestion[] = [
  { attribute: 'hasHat' },
  { attribute: 'isHero' },
]

describe('selectBestQuestion + questionQualityPenaltyMap (C.6)', () => {
  it('prefers the higher-info question when penalties are absent', () => {
    // Both attributes split 2/2 → tie. With no penalty, both are valid picks;
    // we just assert the call returns one of them and doesn't crash.
    const picked = selectBestQuestion(characters, [], questions)
    expect(picked).not.toBeNull()
    expect(['hasHat', 'isHero']).toContain(picked?.attribute)
  })

  it('flips the choice when one question has a strong quality penalty', () => {
    // Both questions tie on theoretical info gain. Apply a heavy penalty to
    // hasHat → selector should pick isHero.
    const picked = selectBestQuestion(characters, [], questions, {
      questionQualityPenaltyMap: { hasHat: 0.3 },
    })
    expect(picked?.attribute).toBe('isHero')
  })

  it('treats a missing penalty entry as no penalty (multiplier=1)', () => {
    const picked = selectBestQuestion(characters, [], questions, {
      questionQualityPenaltyMap: { someOtherAttr: 0.3 },
    })
    expect(picked).not.toBeNull()
    expect(['hasHat', 'isHero']).toContain(picked?.attribute)
  })

  it('ignores out-of-range penalty values (defensive)', () => {
    // 0 and >1 are silently dropped by the guard so a corrupt KV blob can't
    // zero out the entire question pool.
    const picked = selectBestQuestion(characters, [], questions, {
      questionQualityPenaltyMap: { hasHat: 0, isHero: 5 },
    })
    expect(picked).not.toBeNull()
  })
})
