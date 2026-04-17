import { describe, it, expect } from 'vitest'
import { encodeChallenge, decodeChallenge, generateShareText } from './sharing'
import type { SharePayload } from './sharing'

const samplePayload: SharePayload = {
  characterId: 'mario',
  characterName: 'Mario',
  won: true,
  difficulty: 'medium',
  questionCount: 5,
  steps: [
    { questionText: 'Is a human?', attribute: 'isHuman', answer: 'yes' },
    { questionText: 'From a video game?', attribute: 'isVideoGame', answer: 'yes' },
    { questionText: 'Is female?', attribute: 'isFemale', answer: 'no' },
    { questionText: 'Has powers?', attribute: 'hasPowers', answer: 'maybe' },
    { questionText: 'Is a villain?', attribute: 'isVillain', answer: 'no' },
  ],
}

describe('encodeChallenge / decodeChallenge', () => {
  it('round-trips a payload correctly', () => {
    const encoded = encodeChallenge(samplePayload)
    const decoded = decodeChallenge(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.characterId).toBe('mario')
    expect(decoded!.characterName).toBe('Mario')
    expect(decoded!.won).toBe(true)
    expect(decoded!.difficulty).toBe('medium')
    expect(decoded!.questionCount).toBe(5)
    expect(decoded!.steps).toHaveLength(5)
    expect(decoded!.steps[0].answer).toBe('yes')
    expect(decoded!.steps[2].answer).toBe('no')
    expect(decoded!.steps[3].answer).toBe('maybe')
  })

  it('produces a URL-safe string (no +, /, =)', () => {
    const encoded = encodeChallenge(samplePayload)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('returns null for invalid input', () => {
    expect(decodeChallenge('not-valid-base64!!')).toBeNull()
    expect(decodeChallenge('')).toBeNull()
  })

  it('decodes all difficulty levels', () => {
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const encoded = encodeChallenge({ ...samplePayload, difficulty: diff })
      const decoded = decodeChallenge(encoded)
      expect(decoded!.difficulty).toBe(diff)
    }
  })

  it('handles a loss', () => {
    const encoded = encodeChallenge({ ...samplePayload, won: false })
    const decoded = decodeChallenge(encoded)
    expect(decoded!.won).toBe(false)
  })
})

describe('generateShareText', () => {
  it('includes character question count and emoji bar', () => {
    const text = generateShareText(samplePayload)
    expect(text).toContain('5 questions')
    expect(text).toContain('🟢')
    expect(text).toContain('🔴')
    expect(text).toContain('🟡')
    expect(text).toContain('Medium')
  })

  it('says "guessed it" for wins', () => {
    expect(generateShareText(samplePayload)).toContain('guessed it')
  })

  it('says "was stumped" for losses', () => {
    expect(generateShareText({ ...samplePayload, won: false })).toContain('was stumped')
  })
})
