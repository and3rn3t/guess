import { describe, it, expect } from 'vitest'
import {
  calculateProbabilities,
  selectBestQuestion,
  shouldMakeGuess,
  evaluateGuessReadiness,
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

  it('penalizes characters that contradict a "yes" answer (soft scoring)', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const probs = calculateProbabilities(CHARS, answers)

    // Mario and Link are human (true), should have much higher probability
    expect(probs.get('mario')!).toBeGreaterThan(0)
    expect(probs.get('link')!).toBeGreaterThan(0)
    // Pikachu and Kirby are not human — heavily penalized but not zero
    expect(probs.get('pikachu')!).toBeGreaterThan(0)
    expect(probs.get('pikachu')!).toBeLessThan(0.05)
    expect(probs.get('kirby')!).toBeGreaterThan(0)
    expect(probs.get('kirby')!).toBeLessThan(0.05)
  })

  it('penalizes characters that contradict a "no" answer (soft scoring)', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'no' }]
    const probs = calculateProbabilities(CHARS, answers)

    // Mario and Link are human — heavily penalized but not zero
    expect(probs.get('mario')!).toBeGreaterThan(0)
    expect(probs.get('mario')!).toBeLessThan(0.05)
    expect(probs.get('link')!).toBeGreaterThan(0)
    expect(probs.get('link')!).toBeLessThan(0.05)
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

  it('strongly favors the matching character with specific answers', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)

    // Kirby: not human ✓ + can fly ✓ — dominant
    expect(probs.get('kirby')!).toBeGreaterThan(0.9)
    // Others have 1-2 mismatches — heavily penalized
    expect(probs.get('mario')!).toBeLessThan(0.01)
    expect(probs.get('link')!).toBeLessThan(0.01)
    expect(probs.get('pikachu')!).toBeLessThan(0.1)
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
    // Top-K stochastic sampling may pick any high-info-gain question,
    // but isHuman should be among the top candidates.
    // 1000 iterations keeps z-score ~2.75 for the ~38% vs ~31% margin.
    const counts: Record<string, number> = {}
    for (let i = 0; i < 1000; i++) {
      const q = selectBestQuestion(CHARS, [], QUESTIONS)
      counts[q!.attribute] = (counts[q!.attribute] || 0) + 1
    }
    // Top stochastic pick should remain among strongest splitters.
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    expect(['isHuman', 'usesWeapons']).toContain(best[0])
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
  it('returns true when only 1 character remains (after min questions)', () => {
    const one = [CHARS[0]]
    expect(shouldMakeGuess(one, [], 5)).toBe(true)
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

  it('returns true with high confidence when top candidate dominates a 2-char pool', () => {
    // 2-char pool: usesWeapons=no strongly favors Mario over Link
    const twoChars = [CHARS[0], CHARS[1]] // Mario (usesWeapons=false), Link (usesWeapons=true)
    const answers: Answer[] = [{ questionId: 'usesWeapons', value: 'no' }]
    // Mario: 1.0, Link: 0.05 (1 mismatch). topProb ≈ 95%, gap ≈ 90%
    expect(shouldMakeGuess(twoChars, answers, 2)).toBe(true)
  })

  it('returns false when only 2 candidates remain but split is 50/50', () => {
    // isHuman=yes narrows to Mario and Link (2 candidates)
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    expect(shouldMakeGuess(CHARS, answers, 3)).toBe(false)
  })
})

describe('evaluateGuessReadiness', () => {
  it('marks max-questions guesses as forced', () => {
    const readiness = evaluateGuessReadiness(CHARS, [], 15, 15)
    expect(readiness.shouldGuess).toBe(true)
    expect(readiness.forced).toBe(true)
    expect(readiness.trigger).toBe('max_questions')
  })

  it('avoids early guess when confidence is below high-certainty cutoff', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const readiness = evaluateGuessReadiness(CHARS, answers, 2, 15)
    expect(readiness.shouldGuess).toBe(false)
    expect(readiness.trigger).toBe('insufficient_data')
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
  it('does not auto-trigger with contradictory answers (soft scoring keeps all alive)', () => {
    // With SCORE_MISMATCH=0.05, no character is zeroed; contradicted chars are penalized
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)
    const remaining = Array.from(probs.values()).filter((p) => p > 0).length
    expect(remaining).toBe(4)  // all 4 survive with soft penalties

    // shouldMakeGuess returns false — max prob ~33%, well below threshold
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
    // With MAX_MISMATCHES=2, isHuman mismatch on Pikachu/Kirby = 1 → all 4 kept
    expect(result.remainingCount).toBe(4)
  })

  it('detects contradiction when all characters are eliminated', () => {
    // Use a focused fixture: a single character with 3 attributes all true.
    // Answering 'no' to all three gives 3 mismatches > MAX_MISMATCHES=2 → eliminated.
    const strictChar: Character[] = [
      { id: 'x', name: 'X', category: 'video-games', attributes: { a: true, b: true, c: true } },
    ]
    const answers: Answer[] = [
      { questionId: 'a', value: 'no' },
      { questionId: 'b', value: 'no' },
      { questionId: 'c', value: 'no' },
    ]
    const result = detectContradictions(strictChar, answers)
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

  it('confidence increases when top candidate is favored', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const reasoning = generateReasoning(QUESTIONS[1], CHARS, answers)
    // Mario & Link at ~47.6% each (Pikachu/Kirby still have residual 2.4%)
    expect(reasoning.confidence).toBeGreaterThanOrEqual(47)
    expect(reasoning.confidence).toBeLessThanOrEqual(50)
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
    // Use a focused fixture: a single character with 3 attributes all true.
    // Answering 'no' to all three gives 3 mismatches > MAX_MISMATCHES=2 → eliminated.
    const strictChar: Character[] = [
      { id: 'x', name: 'X', category: 'video-games', attributes: { a: true, b: true, c: true } },
    ]
    const answers: Answer[] = [
      { questionId: 'a', value: 'no' },
      { questionId: 'b', value: 'no' },
      { questionId: 'c', value: 'no' },
    ]
    const result = detectContradictions(strictChar, answers)
    expect(result.hasContradiction).toBe(true)
    expect(result.remainingCount).toBe(0)
  })

  it('returns correct remaining count', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(false)
    // All 4 kept: isHuman mismatch on Pikachu/Kirby = 1 ≤ MAX_MISMATCHES=2
    expect(result.remainingCount).toBe(4)
  })
})

// ========== ADDITIONAL EDGE CASES ==========

describe('shouldMakeGuess – progressive thresholds', () => {
  // Create a pool where top candidate has ~60% probability
  const pool: Character[] = [
    { id: 'a', name: 'A', category: 'movies', attributes: { isHuman: true, canFly: false } },
    { id: 'b', name: 'B', category: 'movies', attributes: { isHuman: true, canFly: true } },
    { id: 'c', name: 'C', category: 'movies', attributes: { isHuman: false, canFly: false } },
  ]

  it('guesses when one candidate overwhelmingly dominates (2-char pool)', () => {
    // Use a 2-char subset so highCertainty (aliveCount ≤ 2) can fire
    const pair: Character[] = [pool[0], pool[1]] // A and B
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'no' },
    ]
    // A matches both; B has 1 mismatch (canFly) → A at ~95%, aliveCount=2
    const result = shouldMakeGuess(pair, answers, 2, 4)
    expect(result).toBe(true)
  })

  it('does not guess at 75% progress with weak top candidate', () => {
    const chars: Character[] = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`, name: `C${i}`, category: 'movies' as const,
      attributes: { trait: i === 0 ? true : null },
    }))
    const answers: Answer[] = [{ questionId: 'trait', value: 'yes' }]
    const result = shouldMakeGuess(chars, answers, 3, 4)
    expect(result).toBe(false)
  })

  it('guesses at halfway only when gap and confidence are both strong', () => {
    // Two chars where one dominates after answers
    const chars: Character[] = [
      { id: 'top', name: 'Top', category: 'movies', attributes: { a: true, b: true } },
      { id: 'bot', name: 'Bot', category: 'movies', attributes: { a: true, b: false } },
      { id: 'elim', name: 'Elim', category: 'movies', attributes: { a: false, b: false } },
    ]
    const answers: Answer[] = [
      { questionId: 'a', value: 'yes' },
      { questionId: 'b', value: 'yes' },
    ]
    // At halfway (5/10), gap between top and second should be large
    const result = shouldMakeGuess(chars, answers, 5, 10)
    expect(result).toBe(true)
  })
})

describe('selectBestQuestion – coverage penalty', () => {
  it('penalizes questions where >60% of characters have null attributes', () => {
    // Create characters where most have null for 'rareAttr'
    const chars: Character[] = [
      { id: 'a', name: 'A', category: 'movies', attributes: { common: true } },
      { id: 'b', name: 'B', category: 'movies', attributes: { common: false } },
      { id: 'c', name: 'C', category: 'movies', attributes: { common: true, rareAttr: true } },
    ]
    const questions: Question[] = [
      { id: 'q1', text: 'Common?', attribute: 'common' },
      { id: 'q2', text: 'Rare?', attribute: 'rareAttr' },
    ]
    // 'common' has full coverage, 'rareAttr' has 67% null → penalized
    const best = selectBestQuestion(chars, [], questions)
    expect(best?.attribute).toBe('common')
  })

  it('prefers a decisive top-candidate separator late in the game', () => {
    const chars: Character[] = [
      { id: 'a', name: 'A', category: 'movies', attributes: { seedA: true, seedB: true, decisive: true, broad: true } },
      { id: 'b', name: 'B', category: 'movies', attributes: { seedA: true, seedB: true, decisive: false, broad: true } },
      { id: 'c', name: 'C', category: 'movies', attributes: { seedA: null, seedB: null, decisive: null, broad: false } },
      { id: 'd', name: 'D', category: 'movies', attributes: { seedA: null, seedB: null, decisive: null, broad: false } },
      { id: 'e', name: 'E', category: 'movies', attributes: { seedA: null, seedB: null, decisive: null, broad: false } },
    ]
    const questions: Question[] = [
      { id: 'q1', text: 'Decisive?', attribute: 'decisive' },
      { id: 'q2', text: 'Broad?', attribute: 'broad' },
    ]
    const answers: Answer[] = [
      { questionId: 'seedA', value: 'yes' },
      { questionId: 'seedB', value: 'yes' },
    ]

    const question = selectBestQuestion(chars, answers, questions, { progress: 0.9 })
    expect(question?.attribute).toBe('decisive')
  })
})

describe('generateReasoning – topCandidates', () => {
  it('returns up to 5 top candidates with probabilities', () => {
    const manyChars: Character[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`, name: `Char${i}`, category: 'movies' as const,
      attributes: { trait: i < 5 },
    }))
    const q: Question = { id: 'q', text: 'Has trait?', attribute: 'trait' }
    const result = generateReasoning(q, manyChars, [])
    expect(result.topCandidates).toHaveLength(5)
    expect(result.topCandidates![0]).toHaveProperty('name')
    expect(result.topCandidates![0]).toHaveProperty('probability')
  })

  it('includes why and impact explanation strings', () => {
    const q: Question = { id: 'q', text: 'Is human?', attribute: 'isHuman' }
    const result = generateReasoning(q, CHARS, [])
    expect(result.why).toBeTruthy()
    expect(result.impact).toContain('eliminate')
  })

  it('handles near-equal splits in why explanation', () => {
    // 2 true, 2 false for isHuman → near-equal split
    const q: Question = { id: 'q', text: 'Is human?', attribute: 'isHuman' }
    const result = generateReasoning(q, CHARS, [])
    // "splits the possibilities almost perfectly" or similar
    expect(result.why).toContain('split')
  })
})

// --- attribute group diversity ---

describe('selectBestQuestion – attribute group diversity', () => {
  it('penalises a question in the same attribute group as a recently asked one', () => {
    // All 4 chars split 50/50 on both questions — equal information gain.
    // canTeleport ('ability') is penalised because canFly ('ability') was recently answered.
    // isLeader ('role') is not penalised.
    const chars: Character[] = [
      { id: 'a', name: 'A', category: 'movies', attributes: { canTeleport: true, isLeader: true } },
      { id: 'b', name: 'B', category: 'movies', attributes: { canTeleport: true, isLeader: true } },
      { id: 'c', name: 'C', category: 'movies', attributes: { canTeleport: false, isLeader: false } },
      { id: 'd', name: 'D', category: 'movies', attributes: { canTeleport: false, isLeader: false } },
    ]
    const questions: Question[] = [
      { id: 'q1', text: 'Can teleport?', attribute: 'canTeleport' },
      { id: 'q2', text: 'Is a leader?', attribute: 'isLeader' },
    ]
    const answers: Answer[] = [{ questionId: 'canFly', value: 'yes' }]

    const counts: Record<string, number> = { canTeleport: 0, isLeader: 0 }
    for (let i = 0; i < 1000; i++) {
      const q = selectBestQuestion(chars, answers, questions)
      if (q) counts[q.attribute] = (counts[q.attribute] || 0) + 1
    }
    // isLeader should be selected more often than canTeleport
    expect(counts['isLeader']).toBeGreaterThan(counts['canTeleport'])
  })
})

// --- minimum question guard ---

describe('evaluateGuessReadiness – minimum question guard', () => {
  it('blocks a guess before 5 questions unless probability is overwhelming (≥95%)', () => {
    // 3 chars: after isHuman=yes, topProb ≈ 71% — clear but below the 95% early override
    const chars: Character[] = [
      { id: 'x', name: 'X', category: 'movies', attributes: { isHuman: true } },
      { id: 'y', name: 'Y', category: 'movies', attributes: { isHuman: false } },
      { id: 'z', name: 'Z', category: 'movies', attributes: { isHuman: null } },
    ]
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const readiness = evaluateGuessReadiness(chars, answers, 4, 15)
    expect(readiness.shouldGuess).toBe(false)
    expect(readiness.trigger).toBe('insufficient_data')
  })

  it('allows an early guess when probability is overwhelmingly high (≥95%)', () => {
    // 2-char pool: a=MATCH, b=MISMATCH → topProb ≈ 95.2%, bypasses the minimum-question guard
    const chars: Character[] = [
      { id: 'a', name: 'A', category: 'movies', attributes: { usesWeapons: false } },
      { id: 'b', name: 'B', category: 'movies', attributes: { usesWeapons: true } },
    ]
    const answers: Answer[] = [{ questionId: 'usesWeapons', value: 'no' }]
    const readiness = evaluateGuessReadiness(chars, answers, 3, 15)
    expect(readiness.shouldGuess).toBe(true)
  })
})

// ========== scoreForAnswer null attribute branches ==========

describe('calculateProbabilities – null attribute scoring', () => {
  it("applies effectiveUnknown for 'no' answer when attribute is null", () => {
    // isMale is null for Pikachu and Kirby.
    // 'no' to isMale: Mario/Link (true) → MISMATCH(0.05), Pikachu/Kirby (null) → SCORE_UNKNOWN(0.35)
    const answers: Answer[] = [{ questionId: 'isMale', value: 'no' }]
    const probs = calculateProbabilities(CHARS, answers)

    // Null chars score higher than the mismatched chars
    expect(probs.get('pikachu')!).toBeGreaterThan(probs.get('mario')!)
    expect(probs.get('kirby')!).toBeGreaterThan(probs.get('link')!)
    // Both should still have some probability
    expect(probs.get('pikachu')!).toBeGreaterThan(0)
    expect(probs.get('mario')!).toBeGreaterThan(0)
  })

  it("applies effectiveUnknown for 'maybe' answer when attribute is null", () => {
    // 'maybe' to isMale: Mario/Link (true) → SCORE_MAYBE(0.7), Pikachu/Kirby (null) → SCORE_UNKNOWN(0.35)
    const answers: Answer[] = [{ questionId: 'isMale', value: 'maybe' }]
    const probs = calculateProbabilities(CHARS, answers)

    // SCORE_MAYBE(0.7) > SCORE_UNKNOWN(0.35), so Mario/Link rank above Pikachu/Kirby
    expect(probs.get('mario')!).toBeGreaterThan(probs.get('pikachu')!)
    expect(probs.get('link')!).toBeGreaterThan(probs.get('kirby')!)
    // All should still have nonzero probability
    CHARS.forEach((c) => expect(probs.get(c.id)!).toBeGreaterThan(0))
  })
})

// ========== calculateProbabilities with ScoringOptions ==========

describe('calculateProbabilities – coverageMap', () => {
  it('gives higher score to null-attribute chars when coverage is high', () => {
    // Pikachu/Kirby have null for isMale.
    // effectiveUnknown = 0.3 + 0.25 * coverage.
    // High coverage → effectiveUnknown = 0.525 (less penalty)
    // Low coverage  → effectiveUnknown = 0.325 (more penalty)
    const answersYes: Answer[] = [{ questionId: 'isMale', value: 'yes' }]
    const highCov = calculateProbabilities(CHARS, answersYes, { coverageMap: new Map([['isMale', 0.9]]) })
    const lowCov  = calculateProbabilities(CHARS, answersYes, { coverageMap: new Map([['isMale', 0.1]]) })

    expect(highCov.get('pikachu')!).toBeGreaterThan(lowCov.get('pikachu')!)
    expect(highCov.get('kirby')!).toBeGreaterThan(lowCov.get('kirby')!)
  })
})

describe('calculateProbabilities – popularityMap', () => {
  it('boosts popular characters early in the game', () => {
    // With no answers (uniform Bayesian), Mario (popularity=1.0) should rank above
    // Kirby (popularity=0.2) due to the popularity prior at progress=0.
    const popularityMap = new Map([['mario', 1.0], ['link', 0.5], ['pikachu', 0.8], ['kirby', 0.2]])
    const probs = calculateProbabilities(CHARS, [], { popularityMap, progress: 0.0 })

    expect(probs.get('mario')!).toBeGreaterThan(probs.get('kirby')!)
    expect(probs.get('pikachu')!).toBeGreaterThan(probs.get('kirby')!)
  })

  it('decays popularity influence as game progresses toward end', () => {
    // At progress=0 popularity prior is at full strength; at progress=1 it vanishes.
    // The gap between mario (high pop) and kirby (low pop) should shrink over progress.
    const popularityMap = new Map([['mario', 1.0], ['link', 0.5], ['pikachu', 0.8], ['kirby', 0.2]])

    const earlyProbs = calculateProbabilities(CHARS, [], { popularityMap, progress: 0.0 })
    const lateProbs  = calculateProbabilities(CHARS, [], { popularityMap, progress: 1.0 })

    const earlyGap = earlyProbs.get('mario')! - earlyProbs.get('kirby')!
    const lateGap  = lateProbs.get('mario')!  - lateProbs.get('kirby')!

    expect(earlyGap).toBeGreaterThan(lateGap)
  })
})

// ========== calculateProbabilities early-exit branch ==========

describe('calculateProbabilities – early exit', () => {
  it('zeroes a character whose score falls below 1e-8 after 7+ definite mismatches', () => {
    // SCORE_MISMATCH = 0.05 → 0.05^7 ≈ 7.8e-10 < 1e-8; the early-exit fires.
    const chars: Character[] = [
      {
        id: 'all-true',
        name: 'AllTrue',
        category: 'movies',
        attributes: { a: true, b: true, c: true, d: true, e: true, f: true, g: true },
      },
      {
        id: 'all-false',
        name: 'AllFalse',
        category: 'movies',
        attributes: { a: false, b: false, c: false, d: false, e: false, f: false, g: false },
      },
    ]
    // Answering 'no' to every attribute → 'all-true' gets 7 definite mismatches
    const answers: Answer[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((attr) => ({
      questionId: attr,
      value: 'no' as const,
    }))
    const probs = calculateProbabilities(chars, answers)

    // 'all-true' should be zeroed out; 'all-false' takes all probability
    expect(probs.get('all-true')!).toBe(0)
    expect(probs.get('all-false')!).toBeCloseTo(1)
  })
})

// ========== evaluateGuessReadiness – singleton with < 5 questions ==========

describe('evaluateGuessReadiness – singleton with fewer than 5 questions', () => {
  it('falls through to high_certainty when 1 char remains but questionCount < 5', () => {
    // The singleton guard requires questionCount >= 5.
    // With questionCount=3 it doesn't fire; instead highCertainty fires (topProb=1.0).
    const chars: Character[] = [
      { id: 'only', name: 'Only', category: 'movies', attributes: {} },
    ]
    const readiness = evaluateGuessReadiness(chars, [], 3, 15)

    expect(readiness.shouldGuess).toBe(true)
    expect(readiness.trigger).toBe('high_certainty')
  })
})

// ========== evaluateGuessReadiness – strict_readiness ==========

describe('evaluateGuessReadiness – strict_readiness trigger', () => {
  it('fires strict_readiness when confidence meets threshold but topProb is below highCertainty cutoff', () => {
    // topProb=0.86 is below highCertainty(0.87); entropy([0.86,0.14]) ≈ 0.58 bits.
    // At questionCount=10 (progress=0.667): requiredConfidence≈0.74, requiredEntropy=1.10 bits.
    // 0.86 ≥ 0.74 AND 0.58 ≤ 1.10 → strictReady=true
    const chars: Character[] = [
      { id: 'a', name: 'A', category: 'movies', attributes: {} },
      { id: 'b', name: 'B', category: 'movies', attributes: {} },
    ]
    const preComputedProbs = new Map([['a', 0.86], ['b', 0.14]])
    const readiness = evaluateGuessReadiness(chars, [], 10, 15, 0, undefined, preComputedProbs)

    expect(readiness.shouldGuess).toBe(true)
    expect(readiness.trigger).toBe('strict_readiness')
  })

  it('returns insufficient_data from the final return when entropy is too high for strictReady', () => {
    // topProb=0.75 (below highCertainty(0.87)); entropy([0.75,0.10,0.08,0.04,0.03]) ≈ 1.27 bits.
    // At questionCount=10 (progress=0.667): requiredEntropy=1.10 bits. 1.27 > 1.10 → strictReady=false.
    const chars: Character[] = [
      { id: 'a', name: 'A', category: 'movies', attributes: {} },
      { id: 'b', name: 'B', category: 'movies', attributes: {} },
      { id: 'c', name: 'C', category: 'movies', attributes: {} },
      { id: 'd', name: 'D', category: 'movies', attributes: {} },
      { id: 'e', name: 'E', category: 'movies', attributes: {} },
    ]
    const preComputedProbs = new Map([['a', 0.75], ['b', 0.10], ['c', 0.08], ['d', 0.04], ['e', 0.03]])
    const readiness = evaluateGuessReadiness(chars, [], 10, 15, 0, undefined, preComputedProbs)

    expect(readiness.shouldGuess).toBe(false)
    expect(readiness.trigger).toBe('insufficient_data')
  })
})
