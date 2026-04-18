import { describe, it, expect } from 'vitest'
import {
  calculateProbabilities,
  selectBestQuestion,
  shouldMakeGuess,
  getBestGuess,
  generateReasoning,
  detectContradictions,
} from './gameEngine'
import type { Character, Question, Answer } from './types'

// --- Test fixtures ---

const CHARS: Character[] = [
  {
    id: 'mario',
    name: 'Mario',
    category: 'video-games',
    attributes: { isHuman: true, canFly: false, usesWeapons: false, isMale: true },
  },
  {
    id: 'link',
    name: 'Link',
    category: 'video-games',
    attributes: { isHuman: true, canFly: false, usesWeapons: true, isMale: true },
  },
  {
    id: 'pikachu',
    name: 'Pikachu',
    category: 'video-games',
    attributes: { isHuman: false, canFly: false, usesWeapons: false, isMale: null },
  },
  {
    id: 'kirby',
    name: 'Kirby',
    category: 'video-games',
    attributes: { isHuman: false, canFly: true, usesWeapons: false, isMale: null },
  },
]

const QUESTIONS: Question[] = [
  { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' },
  { id: 'q2', text: 'Can this character fly?', attribute: 'canFly' },
  { id: 'q3', text: 'Does this character use weapons?', attribute: 'usesWeapons' },
  { id: 'q4', text: 'Is this character male?', attribute: 'isMale' },
]

// --- calculateProbabilities ---

describe('calculateProbabilities', () => {
  it('returns uniform probabilities with no answers', () => {
    const probs = calculateProbabilities(CHARS, [])
    expect(probs.size).toBe(4)
    probs.forEach((p) => expect(p).toBeCloseTo(0.25))
  })

  it('eliminates characters that contradict a "yes" answer', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const probs = calculateProbabilities(CHARS, answers)

    // Mario and Link are human (true), should have probability
    expect(probs.get('mario')!).toBeGreaterThan(0)
    expect(probs.get('link')!).toBeGreaterThan(0)
    // Pikachu and Kirby are not human (false), should be eliminated
    expect(probs.get('pikachu')).toBe(0)
    expect(probs.get('kirby')).toBe(0)
  })

  it('eliminates characters that contradict a "no" answer', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'no' }]
    const probs = calculateProbabilities(CHARS, answers)

    expect(probs.get('mario')).toBe(0)
    expect(probs.get('link')).toBe(0)
    expect(probs.get('pikachu')!).toBeGreaterThan(0)
    expect(probs.get('kirby')!).toBeGreaterThan(0)
  })

  it('treats "maybe" as soft evidence — slightly favors true', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'maybe' }]
    const probs = calculateProbabilities(CHARS, answers)
    // Mario and Link are human (true) → soft positive (0.7)
    // Pikachu and Kirby are not human (false) → soft negative (0.3)
    expect(probs.get('mario')!).toBeGreaterThan(probs.get('pikachu')!)
    expect(probs.get('link')!).toBeGreaterThan(probs.get('kirby')!)
    // All should still have non-zero probability
    CHARS.forEach((c) => {
      expect(probs.get(c.id)!).toBeGreaterThan(0)
    })
    // Should still sum to 1
    const total = Array.from(probs.values()).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
  })

  it('treats "unknown" answers as neutral — same as "maybe"', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'unknown' }]
    const probs = calculateProbabilities(CHARS, answers)
    probs.forEach((p) => expect(p).toBeCloseTo(0.25))
  })

  it('gives partial credit for null attributes', () => {
    // "Is this character male?" — pikachu and kirby have null for isMale
    const answers: Answer[] = [{ questionId: 'isMale', value: 'yes' }]
    const probs = calculateProbabilities(CHARS, answers)

    // Mario and Link are male (true) → full score
    // Pikachu and Kirby are null → 0.5 score
    expect(probs.get('mario')!).toBeGreaterThan(probs.get('pikachu')!)
    expect(probs.get('link')!).toBeGreaterThan(probs.get('kirby')!)
    // Null chars should still have some probability
    expect(probs.get('pikachu')!).toBeGreaterThan(0)
  })

  it('normalizes probabilities to sum to 1', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)
    const total = Array.from(probs.values()).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
  })

  it('narrows down to a single character with specific answers', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)

    // Only Kirby: not human + can fly
    expect(probs.get('kirby')).toBeCloseTo(1)
    expect(probs.get('mario')).toBe(0)
    expect(probs.get('link')).toBe(0)
    expect(probs.get('pikachu')).toBe(0)
  })
})

// --- selectBestQuestion ---

describe('selectBestQuestion', () => {
  it('returns a question when available', () => {
    const q = selectBestQuestion(CHARS, [], QUESTIONS)
    expect(q).not.toBeNull()
    expect(QUESTIONS).toContain(q)
  })

  it('does not re-ask already-answered questions', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const q = selectBestQuestion(CHARS, answers, QUESTIONS)
    expect(q?.attribute).not.toBe('isHuman')
  })

  it('returns null when all questions have been asked', () => {
    const answers: Answer[] = QUESTIONS.map((q) => ({ questionId: q.attribute, value: 'yes' as const }))
    const q = selectBestQuestion(CHARS, answers, QUESTIONS)
    expect(q).toBeNull()
  })

  it('prefers questions that split possibilities evenly', () => {
    // isHuman splits 2 (true) / 2 (false) — perfect 50/50
    // canFly splits 1 (true) / 3 (false) — imbalanced
    // With no prior answers, isHuman should be preferred (highest info gain)
    const q = selectBestQuestion(CHARS, [], QUESTIONS)
    expect(q?.attribute).toBe('isHuman')
  })

  it('boosts differentiating questions when top-2 dominate', () => {
    // After answering "yes" to isHuman, Mario and Link are left
    // usesWeapons differentiates them (Mario=false, Link=true)
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const q = selectBestQuestion(CHARS, answers, QUESTIONS)
    expect(q?.attribute).toBe('usesWeapons')
  })
})

// --- shouldMakeGuess ---

describe('shouldMakeGuess', () => {
  it('returns true when only 1 character remains', () => {
    const one = [CHARS[0]]
    expect(shouldMakeGuess(one, [], 0)).toBe(true)
  })

  it('returns true when 0 characters remain', () => {
    expect(shouldMakeGuess([], [], 0)).toBe(true)
  })

  it('returns false early in the game with even probabilities', () => {
    expect(shouldMakeGuess(CHARS, [], 1)).toBe(false)
  })

  it('returns true when reaching maxQuestions', () => {
    expect(shouldMakeGuess(CHARS, [], 15, 15)).toBe(true)
  })

  it('respects custom maxQuestions', () => {
    expect(shouldMakeGuess(CHARS, [], 10, 10)).toBe(true)
    expect(shouldMakeGuess(CHARS, [], 9, 10)).toBe(false)
  })

  it('returns true with high confidence (>80%)', () => {
    // Narrow to Mario with answers that eliminate others
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'no' },
    ]
    expect(shouldMakeGuess(CHARS, answers, 2)).toBe(true)
  })

  it('returns true when only 2 candidates remain after 3+ questions', () => {
    // isHuman=yes narrows to Mario and Link (2 candidates)
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    // With 3 questions asked, should trigger the early termination
    expect(shouldMakeGuess(CHARS, answers, 3)).toBe(true)
  })
})

// --- unknown answer type ---

describe('calculateProbabilities – unknown answer', () => {
  it('does not eliminate a character with attribute=true when answer is unknown', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'unknown' }]
    const probs = calculateProbabilities(CHARS, answers)

    // Mario has isHuman=true — must NOT be eliminated
    expect(probs.get('mario')!).toBeGreaterThan(0)
    // All characters should retain equal probability
    CHARS.forEach((c) => {
      expect(probs.get(c.id)!).toBeCloseTo(0.25)
    })
  })
})

// --- tie-breaking in getBestGuess ---

describe('getBestGuess – tie-breaking', () => {
  it('deterministically selects via alphabetical id when probabilities are equal', () => {
    // With no answers all 4 are equal; sorted by localeCompare → kirby first
    const guess = getBestGuess(CHARS, [])
    expect(guess).not.toBeNull()
    expect(guess!.id).toBe('kirby')
  })

  it('returns the higher-probability character regardless of id order', () => {
    // Narrow to Link: human + uses weapons
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const guess = getBestGuess(CHARS, answers)
    expect(guess!.id).toBe('link')
  })
})

// --- edge case: empty characters ---

describe('getBestGuess – edge cases', () => {
  it('returns null for empty characters array', () => {
    expect(getBestGuess([], [])).toBeNull()
  })
})

// --- edge case: all characters eliminated ---

describe('shouldMakeGuess – all eliminated', () => {
  it('does not auto-trigger when all characters are eliminated mid-game', () => {
    // Contradictory: isHuman=yes keeps Mario & Link, canFly=yes keeps Kirby → 0 overlap
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)
    const remaining = Array.from(probs.values()).filter((p) => p > 0).length
    expect(remaining).toBe(0)

    // shouldMakeGuess only checks confidence/maxQuestions — all-zero probs don't exceed 0.8
    expect(shouldMakeGuess(CHARS, answers, 2)).toBe(false)
  })

  it('triggers at maxQuestions even when all eliminated', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    expect(shouldMakeGuess(CHARS, answers, 15)).toBe(true)
  })
})

// --- detectContradictions ---

describe('detectContradictions', () => {
  it('reports no contradiction with no answers', () => {
    const result = detectContradictions(CHARS, [])
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(CHARS.length)
  })

  it('reports no contradiction with valid answers', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(2)
  })

  it('detects contradiction when all characters are eliminated', () => {
    // isHuman=yes keeps Mario & Link; canFly=yes keeps Kirby → intersection = 0
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(true)
    expect(result.remainingCount).toBe(0)
  })
})

// --- getBestGuess ---

describe('getBestGuess', () => {
  it('returns the character with highest probability', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const guess = getBestGuess(CHARS, answers)
    expect(guess?.id).toBe('link')
  })

  it('returns null for empty character array', () => {
    expect(getBestGuess([], [])).toBeNull()
  })

  it('returns a character even with no answers', () => {
    const guess = getBestGuess(CHARS, [])
    expect(guess).not.toBeNull()
  })

  it('breaks ties deterministically by character ID', () => {
    // With no answers, all characters have equal probability
    // Should pick alphabetically first by ID: kirby
    const guess = getBestGuess(CHARS, [])
    expect(guess).not.toBeNull()
    expect(guess!.id).toBe('kirby')
  })
})

// --- generateReasoning ---

describe('generateReasoning', () => {
  it('returns all required fields', () => {
    const reasoning = generateReasoning(QUESTIONS[0], CHARS, [])
    expect(reasoning).toHaveProperty('why')
    expect(reasoning).toHaveProperty('impact')
    expect(reasoning).toHaveProperty('remaining')
    expect(reasoning).toHaveProperty('confidence')
    expect(typeof reasoning.why).toBe('string')
    expect(typeof reasoning.impact).toBe('string')
    expect(reasoning.remaining).toBe(4)
    expect(reasoning.confidence).toBeGreaterThanOrEqual(0)
    expect(reasoning.confidence).toBeLessThanOrEqual(100)
  })

  it('confidence is 25% with 4 equal characters', () => {
    const reasoning = generateReasoning(QUESTIONS[0], CHARS, [])
    expect(reasoning.confidence).toBe(25)
  })

  it('confidence increases when characters are eliminated', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const reasoning = generateReasoning(QUESTIONS[1], CHARS, answers)
    expect(reasoning.confidence).toBe(50)
  })
})

// --- detectContradictions ---

describe('detectContradictions', () => {
  it('returns no contradiction with no answers', () => {
    const result = detectContradictions(CHARS, [])
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(4)
  })

  it('detects contradiction when all characters eliminated', () => {
    // isHuman=yes eliminates Pikachu/Kirby, canFly=yes eliminates Mario/Link
    // → 0 remaining
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(true)
    expect(result.remainingCount).toBe(0)
  })

  it('returns correct remaining count', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(2)
  })
})
