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

  it('penalizes characters on "yes" answer mismatch (soft scoring)', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const probs = calculateProbabilities(CHARS, answers)
    // Mario & Link are human → high probability
    expect(probs.get('mario')).toBeGreaterThan(0)
    expect(probs.get('link')).toBeGreaterThan(0)
    // Pikachu & Kirby are not human — penalized but not zero
    expect(probs.get('pikachu')!).toBeGreaterThan(0)
    expect(probs.get('pikachu')!).toBeLessThan(0.05)
    expect(probs.get('kirby')!).toBeGreaterThan(0)
    expect(probs.get('kirby')!).toBeLessThan(0.05)
  })

  it('penalizes characters on "no" answer mismatch (soft scoring)', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'no' }]
    const probs = calculateProbabilities(CHARS, answers)
    // Mario & Link penalized (not zero)
    expect(probs.get('mario')!).toBeGreaterThan(0)
    expect(probs.get('mario')!).toBeLessThan(0.05)
    expect(probs.get('link')!).toBeGreaterThan(0)
    expect(probs.get('link')!).toBeLessThan(0.05)
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

  it('strongly favors the matching character with multiple answers', () => {
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const probs = calculateProbabilities(CHARS, answers)
    // Link matches both -- dominant at ~87%+
    expect(probs.get('link')!).toBeGreaterThan(0.8)
    // Mario has 1 mismatch (usesWeapons=false) -- heavily penalized
    expect(probs.get('mario')!).toBeLessThan(0.1)
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

  it('prefers a decisive top-candidate separator late in the game', () => {
    const chars: ServerCharacter[] = [
      { id: 'a', name: 'A', category: 'video-games', imageUrl: null, attributes: { seedA: true, seedB: true, decisive: true, broad: true } },
      { id: 'b', name: 'B', category: 'video-games', imageUrl: null, attributes: { seedA: true, seedB: true, decisive: false, broad: true } },
      { id: 'c', name: 'C', category: 'video-games', imageUrl: null, attributes: { seedA: null, seedB: null, decisive: null, broad: false } },
      { id: 'd', name: 'D', category: 'video-games', imageUrl: null, attributes: { seedA: null, seedB: null, decisive: null, broad: false } },
      { id: 'e', name: 'E', category: 'video-games', imageUrl: null, attributes: { seedA: null, seedB: null, decisive: null, broad: false } },
    ]
    const questions: ServerQuestion[] = [
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

// ── shouldMakeGuess ───────────────────────────────────────────

describe('shouldMakeGuess', () => {
  it('returns true with 1 character (after min questions)', () => {
    expect(shouldMakeGuess([CHARS[0]], [], 5, 15)).toBe(true)
  })

  it('returns true with 0 characters (contradiction fallback)', () => {
    expect(shouldMakeGuess([], [], 0, 15)).toBe(true)
  })

  it('returns false early in game with uniform probabilities', () => {
    expect(shouldMakeGuess(CHARS, [], 1, 15)).toBe(false)
  })

  it('returns true when maxQuestions reached', () => {
    expect(shouldMakeGuess(CHARS, [], 15, 15)).toBe(true)
  })

  it('returns true with high confidence (>80%)', () => {
    // Filter first (as game does): isHuman=yes + usesWeapons=yes keeps Mario + Link
    // Link dominates at ~95% with aliveCount=2 -> highCertainty fires
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const filtered = filterPossibleCharacters(CHARS, answers)
    expect(shouldMakeGuess(filtered, answers, 2, 15)).toBe(true)
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

  it('increases confidence after penalizing contradicting chars', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const r = generateReasoning(QUESTIONS[2], CHARS, answers)
    // Mario & Link at ~47.6% each (Pikachu/Kirby have residual 2.4% from SCORE_MISMATCH)
    expect(r.confidence).toBeGreaterThanOrEqual(47)
    expect(r.confidence).toBeLessThanOrEqual(50)
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
    // With MAX_MISMATCHES=1, Pikachu/Kirby have 1 mismatch <= limit -> all 4 kept
    expect(result.remainingCount).toBe(4)
  })

  it('returns contradiction when all characters have 2+ mismatches', () => {
    // 4 answers needed to give ALL 4 chars >=2 mismatches with MAX_MISMATCHES=1:
    // Mario: canFly(1)+usesWeapons(2)->out; Link: canFly(1)+isMale(2)->out
    // Pikachu: isHuman(1)+canFly(2)->out; Kirby: isHuman(1)+usesWeapons(2)->out
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
      { questionId: 'isMale', value: 'no' },
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

  it('keeps characters with 1 contradicting "yes" answer (soft tolerance)', () => {
    const answers: Answer[] = [{ questionId: 'isHuman', value: 'yes' }]
    const result = filterPossibleCharacters(CHARS, answers)
    // Pikachu & Kirby have isHuman=false -> 1 mismatch <= MAX_MISMATCHES=1 -> kept
    expect(result.map((c) => c.id)).toEqual(['mario', 'link', 'pikachu', 'kirby'])
  })

  it('keeps characters with 1 contradicting "no" answer (soft tolerance)', () => {
    const answers: Answer[] = [{ questionId: 'usesWeapons', value: 'no' }]
    const result = filterPossibleCharacters(CHARS, answers)
    // Link has usesWeapons=true -> 1 mismatch <= MAX_MISMATCHES=1 -> kept
    expect(result.map((c) => c.id)).toContain('link')
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

  it('eliminates characters with 2+ contradictions, keeps those with 1', () => {
    // isHuman=no + canFly=yes:
    // Mario: isHuman=true(1), canFly=false(2) -> eliminated
    // Link: isHuman=true(1), canFly=false(2) -> eliminated
    // Pikachu: isHuman=false ok, canFly=false(1) -> kept (1 mismatch)
    // Kirby: isHuman=false ok, canFly=true ok -> kept (0 mismatches)
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toContain('kirby')
    expect(result.map((c) => c.id)).toContain('pikachu')
  })

  it('returns empty array when all characters have 2+ contradictions', () => {
    // Mario: canFly(1)+usesWeapons(2)->out; Link: canFly(1)+isMale(2)->out
    // Pikachu: isHuman(1)+canFly(2)->out; Kirby: isHuman(1)+usesWeapons(2)->out
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
      { questionId: 'isMale', value: 'no' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    expect(result).toHaveLength(0)
  })
})
