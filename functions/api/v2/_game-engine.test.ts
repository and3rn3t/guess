import { describe, it, expect } from 'vitest'
import {
  calculateProbabilities,
  selectBestQuestion,
  shouldMakeGuess,
  getBestGuess,
  generateReasoning,
  detectContradictions,
  filterPossibleCharacters,
  POOL_SIZE,
  MIN_ATTRIBUTES,
  SESSION_TTL,
  DIFFICULTY_MAP,
  VALID_ANSWERS,
  type ServerCharacter,
  type ServerQuestion,
  type Answer,
} from './_game-engine'

// ── Fixtures ──────────────────────────────────────────────────

const CHARS: ServerCharacter[] = [
  {
    id: 'mario',
    name: 'Mario',
    category: 'video-games',
    imageUrl: null,
    attributes: { isHuman: true, canFly: false, usesWeapons: false, isMale: true },
  },
  {
    id: 'link',
    name: 'Link',
    category: 'video-games',
    imageUrl: null,
    attributes: { isHuman: true, canFly: false, usesWeapons: true, isMale: true },
  },
  {
    id: 'pikachu',
    name: 'Pikachu',
    category: 'video-games',
    imageUrl: null,
    attributes: { isHuman: false, canFly: false, usesWeapons: false, isMale: null },
  },
  {
    id: 'kirby',
    name: 'Kirby',
    category: 'video-games',
    imageUrl: 'https://example.com/kirby.png',
    attributes: { isHuman: false, canFly: true, usesWeapons: false, isMale: null },
  },
]

const QUESTIONS: ServerQuestion[] = [
  { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' },
  { id: 'q2', text: 'Can this character fly?', attribute: 'canFly' },
  { id: 'q3', text: 'Does this character use weapons?', attribute: 'usesWeapons' },
  { id: 'q4', text: 'Is this character male?', attribute: 'isMale' },
]

// ── Constants ─────────────────────────────────────────────────

describe('constants', () => {
  it('has expected POOL_SIZE', () => {
    expect(POOL_SIZE).toBe(500)
  })

  it('has expected MIN_ATTRIBUTES', () => {
    expect(MIN_ATTRIBUTES).toBe(5)
  })

  it('has expected SESSION_TTL', () => {
    expect(SESSION_TTL).toBe(3600)
  })

  it('has expected DIFFICULTY_MAP', () => {
    expect(DIFFICULTY_MAP).toEqual({ easy: 20, medium: 15, hard: 10 })
  })

  it('has expected VALID_ANSWERS', () => {
    expect(VALID_ANSWERS).toEqual(new Set(['yes', 'no', 'maybe', 'unknown']))
  })
})

// ── calculateProbabilities ────────────────────────────────────

describe('calculateProbabilities', () => {
  it('returns uniform probabilities with no answers', () => {
    const probs = calculateProbabilities(CHARS, [])
    expect(probs.size).toBe(4)
    probs.forEach((p) => expect(p).toBeCloseTo(0.25))
  })

  it('eliminates characters on "yes" answer mismatch', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const probs = calculateProbabilities(CHARS, answers)
    // Mario & Link are human → nonzero, Pikachu & Kirby are not → 0
    expect(probs.get('mario')).toBeGreaterThan(0)
    expect(probs.get('link')).toBeGreaterThan(0)
    expect(probs.get('pikachu')).toBe(0)
    expect(probs.get('kirby')).toBe(0)
  })

  it('eliminates characters on "no" answer mismatch', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'no' }]
    const probs = calculateProbabilities(CHARS, answers)
    expect(probs.get('mario')).toBe(0)
    expect(probs.get('link')).toBe(0)
    expect(probs.get('pikachu')).toBeGreaterThan(0)
    expect(probs.get('kirby')).toBeGreaterThan(0)
  })

  it('gives partial score for "maybe" answers', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'maybe' }]
    const probs = calculateProbabilities(CHARS, answers)
    // All characters have nonzero probability with "maybe"
    probs.forEach((p) => expect(p).toBeGreaterThan(0))
    // true match (0.7) > false match (0.3)
    expect(probs.get('mario')!).toBeGreaterThan(probs.get('pikachu')!)
  })

  it('gives no effect for "unknown" answers', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'unknown' }]
    const probs = calculateProbabilities(CHARS, answers)
    probs.forEach((p) => expect(p).toBeCloseTo(0.25))
  })

  it('gives null attributes a middle score (0.5)', () => {
    const answers: Answer[] = [{ questionId: 'isMale', value: 'yes' }]
    const probs = calculateProbabilities(CHARS, answers)
    // Mario & Link have isMale=true → higher
    // Pikachu & Kirby have isMale=null → 0.5 score
    expect(probs.get('mario')!).toBeGreaterThan(probs.get('pikachu')!)
  })

  it('normalizes probabilities to sum to 1', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)
    const sum = Array.from(probs.values()).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('narrows to single character with multiple answers', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)
    expect(probs.get('link')).toBeCloseTo(1)
    expect(probs.get('mario')).toBe(0)
  })
})

// ── selectBestQuestion ────────────────────────────────────────

describe('selectBestQuestion', () => {
  it('selects a question from the pool', () => {
    const q = selectBestQuestion(CHARS, [], QUESTIONS)
    expect(q).not.toBeNull()
    expect(QUESTIONS).toContainEqual(q)
  })

  it('does not re-ask already-answered questions', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'no' },
    ]
    const q = selectBestQuestion(CHARS, answers, QUESTIONS)
    expect(q).not.toBeNull()
    expect(q!.attribute).not.toBe('isHuman')
    expect(q!.attribute).not.toBe('canFly')
  })

  it('returns null when all questions exhausted', () => {
    const answers: Answer[] = QUESTIONS.map((q) => ({
      questionId: q.attribute,
      value: 'yes' as const,
    }))
    const q = selectBestQuestion(CHARS, answers, QUESTIONS)
    expect(q).toBeNull()
  })

  it('prefers even-split questions', () => {
    // isHuman splits 2 vs 2 — should be preferred
    const q = selectBestQuestion(CHARS, [], QUESTIONS)
    expect(q).not.toBeNull()
    // isHuman or usesWeapons are the best splits
    expect(['isHuman', 'canFly', 'usesWeapons', 'isMale']).toContain(q!.attribute)
  })
})

// ── shouldMakeGuess ───────────────────────────────────────────

describe('shouldMakeGuess', () => {
  it('returns true with 1 character', () => {
    expect(shouldMakeGuess([CHARS[0]], [], 0, 15)).toBe(true)
  })

  it('returns true with 0 characters', () => {
    expect(shouldMakeGuess([], [], 0, 15)).toBe(true)
  })

  it('returns false early in game with uniform probabilities', () => {
    expect(shouldMakeGuess(CHARS, [], 1, 15)).toBe(false)
  })

  it('returns true when maxQuestions reached', () => {
    expect(shouldMakeGuess(CHARS, [], 15, 15)).toBe(true)
  })

  it('returns true with high confidence (>80%)', () => {
    // Only Mario + Link alive, and "usesWeapons=yes" → Link at ~100%
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    expect(shouldMakeGuess(CHARS, answers, 2, 15)).toBe(true)
  })

  it('returns false with 2 candidates when confidence is still 50/50', () => {
    // isHuman=yes narrows to Mario + Link (50/50)
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    expect(shouldMakeGuess(CHARS, answers, 5, 15)).toBe(false)
  })

  it('returns false late game when posterior is still ambiguous', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    expect(shouldMakeGuess(CHARS, answers, 12, 15)).toBe(false)
  })

  it('returns false early with broad alive pool despite mild confidence lead', () => {
    const chars: ServerCharacter[] = [
      { id: 'a', name: 'A', category: 'video-games', imageUrl: null, attributes: { trait: true } },
      { id: 'b', name: 'B', category: 'video-games', imageUrl: null, attributes: { trait: false } },
      { id: 'c', name: 'C', category: 'video-games', imageUrl: null, attributes: { trait: false } },
      { id: 'd', name: 'D', category: 'video-games', imageUrl: null, attributes: { trait: null } },
    ]
    const answers: Answer[] = [{ questionId: 'trait', value: 'yes' }]
    expect(shouldMakeGuess(chars, answers, 3, 15)).toBe(false)
  })

  it('applies stricter readiness after prior wrong guesses', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'isMale', value: 'yes' },
    ]
    expect(shouldMakeGuess(CHARS, answers, 6, 15, 0)).toBe(false)
    expect(shouldMakeGuess(CHARS, answers, 6, 15, 2)).toBe(false)
  })

  it('uses maxQuestions parameter for easy difficulty', () => {
    expect(shouldMakeGuess(CHARS, [], 19, 20)).toBe(false)
    expect(shouldMakeGuess(CHARS, [], 20, 20)).toBe(true)
  })
})

// ── getBestGuess ──────────────────────────────────────────────

describe('getBestGuess', () => {
  it('returns null for empty array', () => {
    expect(getBestGuess([], [])).toBeNull()
  })

  it('returns the highest probability character', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const guess = getBestGuess(CHARS, answers)
    expect(guess).not.toBeNull()
    // Mario or Link (both equally likely)
    expect(['mario', 'link']).toContain(guess!.id)
  })

  it('picks deterministically with identical probabilities (by ID)', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const g1 = getBestGuess(CHARS, answers)
    const g2 = getBestGuess(CHARS, answers)
    expect(g1!.id).toBe(g2!.id)
    // Tie-broken by id.localeCompare → 'link' < 'mario'
    expect(g1!.id).toBe('link')
  })

  it('returns the unique match with definitive answers', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const guess = getBestGuess(CHARS, answers)
    expect(guess!.id).toBe('kirby')
  })
})

// ── generateReasoning ─────────────────────────────────────────

describe('generateReasoning', () => {
  it('returns all required fields', () => {
    const q = QUESTIONS[0] // isHuman
    const r = generateReasoning(q, CHARS, [])
    expect(r).toHaveProperty('why')
    expect(r).toHaveProperty('impact')
    expect(r).toHaveProperty('remaining')
    expect(r).toHaveProperty('confidence')
    expect(r).toHaveProperty('topCandidates')
    expect(r.remaining).toBe(4)
    expect(r.topCandidates.length).toBeLessThanOrEqual(5)
  })

  it('shows 25% confidence with uniform distribution', () => {
    const r = generateReasoning(QUESTIONS[0], CHARS, [])
    expect(r.confidence).toBe(25)
  })

  it('increases confidence after elimination', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const r = generateReasoning(QUESTIONS[2], CHARS, answers)
    expect(r.confidence).toBe(50)
  })

  it('includes topCandidates with name and probability', () => {
    const r = generateReasoning(QUESTIONS[0], CHARS, [])
    for (const c of r.topCandidates) {
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('probability')
      expect(typeof c.name).toBe('string')
      expect(typeof c.probability).toBe('number')
    }
  })

  it('includes imageUrl in topCandidates', () => {
    const r = generateReasoning(QUESTIONS[0], CHARS, [])
    const kirbyCandidate = r.topCandidates.find((c) => c.name === 'Kirby')
    expect(kirbyCandidate?.imageUrl).toBe('https://example.com/kirby.png')
  })

  it('describes even split for isHuman (2 vs 2)', () => {
    const r = generateReasoning(QUESTIONS[0], CHARS, [])
    expect(r.why).toContain('splits')
    expect(r.impact).toContain('eliminates')
  })

  it('describes minority trait for canFly (1 vs 3)', () => {
    const r = generateReasoning(QUESTIONS[1], CHARS, [])
    // Only 25% can fly — should mention the minority
    expect(r.why).toContain('25%')
  })
})

// ── detectContradictions ──────────────────────────────────────

describe('detectContradictions', () => {
  it('returns no contradiction with no answers', () => {
    const result = detectContradictions(CHARS, [])
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(4)
  })

  it('returns no contradiction with valid answers', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(false)
    expect(result.remainingCount).toBe(2)
  })

  it('returns contradiction when all characters eliminated', () => {
    // isHuman=yes + canFly=yes → only Kirby has canFly but isHuman=false → nobody
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = detectContradictions(CHARS, answers)
    expect(result.hasContradiction).toBe(true)
    expect(result.remainingCount).toBe(0)
  })
})

// ── filterPossibleCharacters ──────────────────────────────────

describe('filterPossibleCharacters', () => {
  it('returns all characters with no answers', () => {
    const result = filterPossibleCharacters(CHARS, [])
    expect(result).toHaveLength(4)
  })

  it('filters out characters with contradicting "yes" answer', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const result = filterPossibleCharacters(CHARS, answers)
    // isHuman=false → eliminated; isHuman=null → kept (no hard contradiction)
    expect(result.map((c) => c.id)).toEqual(['mario', 'link', 'pikachu', 'kirby'].filter((id) => {
      const char = CHARS.find((c) => c.id === id)!
      return char.attributes.isHuman !== false
    }))
  })

  it('filters out characters with contradicting "no" answer', () => {
    const answers: Answer[] = [{ questionId: 'usesWeapons', value: 'no' }]
    const result = filterPossibleCharacters(CHARS, answers)
    // Link has usesWeapons=true → filtered out
    expect(result.map((c) => c.id)).not.toContain('link')
  })

  it('does not filter on "maybe" or "unknown"', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'maybe' },
      { questionId: 'canFly', value: 'unknown' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    expect(result).toHaveLength(4)
  })

  it('keeps characters with null attributes (unknown = no hard contradiction)', () => {
    const answers: Answer[] = [{ questionId: 'isMale', value: 'yes' }]
    const result = filterPossibleCharacters(CHARS, answers)
    // Mario & Link: isMale=true → kept
    // Pikachu & Kirby: isMale=null → kept (null != false)
    expect(result).toHaveLength(4)
  })

  it('handles multiple answers narrowing to one character', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('kirby')
  })

  it('returns empty array when all contradicted', () => {
    // isHuman=yes eliminates Pikachu/Kirby; canFly=yes eliminates Mario/Link
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    expect(result).toHaveLength(0)
  })
})
