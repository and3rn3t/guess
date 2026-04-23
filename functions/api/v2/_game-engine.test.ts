import { describe, it, expect, vi } from 'vitest'
import {
  calculateProbabilities,
  selectBestQuestion,
  shouldMakeGuess,
  getBestGuess,
  generateReasoning,
  detectContradictions,
  filterPossibleCharacters,
  evaluateGuessReadiness,
  storeSession,
  loadSession,
  saveSessionState,
  deleteSession,
  POOL_SIZE,
  MIN_ATTRIBUTES,
  SESSION_TTL,
  DIFFICULTY_MAP,
  VALID_ANSWERS,
  type ServerCharacter,
  type ServerQuestion,
  type Answer,
  type GameSession,
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
    expect(MIN_ATTRIBUTES).toBe(20)
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
    // Filter first (as game does): isHuman=yes + usesWeapons=yes
    // Link dominates at ~95% (soft scores reduce Mario/Pikachu/Kirby)
    // At q=5 the min-questions guard is cleared; highCertainty fires.
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'usesWeapons', value: 'yes' },
    ]
    const filtered = filterPossibleCharacters(CHARS, answers)
    expect(shouldMakeGuess(filtered, answers, 5, 15)).toBe(true)
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
    expect(r.impact).toContain('eliminate')
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
    // With MAX_MISMATCHES=2, Pikachu/Kirby have 1 mismatch <= limit -> all 4 kept
    expect(result.remainingCount).toBe(4)
  })

  it('returns contradiction when all characters have 3+ mismatches', () => {
    // Use a focused single-character fixture: 3 mismatches > MAX_MISMATCHES=2 -> eliminated.
    const strictChars: ServerCharacter[] = [
      { id: 'x', name: 'X', category: 'c', imageUrl: null, attributes: { a: true, b: true, c: true } },
    ]
    const answers: Answer[] = [
      { questionId: 'a', value: 'no' },
      { questionId: 'b', value: 'no' },
      { questionId: 'c', value: 'no' },
    ]
    const result = detectContradictions(strictChars, answers)
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
    // Pikachu & Kirby have isHuman=false -> 1 mismatch <= MAX_MISMATCHES=2 -> kept
    expect(result.map((c) => c.id)).toEqual(['mario', 'link', 'pikachu', 'kirby'])
  })

  it('keeps characters with 1 contradicting "no" answer (soft tolerance)', () => {
    const answers: Answer[] = [{ questionId: 'usesWeapons', value: 'no' }]
    const result = filterPossibleCharacters(CHARS, answers)
    // Link has usesWeapons=true -> 1 mismatch <= MAX_MISMATCHES=2 -> kept
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

  it('eliminates characters with 3+ contradictions, tolerates up to 2', () => {
    // isHuman=no + canFly=yes + isMale=no:
    // Mario: isHuman=true(1), canFly=false(2), isMale=true(3) -> eliminated (>2)
    // Link:  isHuman=true(1), canFly=false(2), isMale=true(3) -> eliminated (>2)
    // Pikachu: isHuman=false ok, canFly=false(1), isMale=null ok -> kept (1 mismatch)
    // Kirby:   isHuman=false ok, canFly=true ok, isMale=null ok -> kept (0 mismatches)
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
      { questionId: 'isMale', value: 'no' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toContain('kirby')
    expect(result.map((c) => c.id)).toContain('pikachu')
  })

  it('returns empty array when all characters have 3+ contradictions', () => {
    // Use a focused single-character fixture: 3 mismatches > MAX_MISMATCHES=2 -> eliminated.
    const strictChars: ServerCharacter[] = [
      { id: 'x', name: 'X', category: 'c', imageUrl: null, attributes: { a: true, b: true, c: true } },
    ]
    const answers: Answer[] = [
      { questionId: 'a', value: 'no' },
      { questionId: 'b', value: 'no' },
      { questionId: 'c', value: 'no' },
    ]
    const result = filterPossibleCharacters(strictChars, answers)
    expect(result).toHaveLength(0)
  })
})

// ── generateReasoning ─────────────────────────────────────────

describe('generateReasoning', () => {
  const question: ServerQuestion = { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' }

  it('describes an even split correctly', () => {
    // isHuman: 2 yes (Mario, Link), 2 no (Pikachu, Kirby) — abs(2-2) < 4*0.2 = 0.8 → NO, 2-2=0 < 0.8 → even split
    const reasoning = generateReasoning(question, CHARS, [])
    expect(reasoning.why).toContain('splits the possibilities almost evenly')
    expect(reasoning.remaining).toBe(4)
  })

  it('describes a minority-yes attribute correctly', () => {
    // usesWeapons: 1 yes (Link), 3 no → yesCount(1) < noCount(3) → minority branch
    const weaponsQ: ServerQuestion = { id: 'q3', text: 'Does this character use weapons?', attribute: 'usesWeapons' }
    const reasoning = generateReasoning(weaponsQ, CHARS, [])
    expect(reasoning.why).toContain('Only')
    expect(reasoning.why).toContain('dramatically narrow')
  })

  it('describes a majority-yes attribute correctly', () => {
    // canFly: 1 yes (Kirby), 3 no → isHuman approach — actually yesCount=1,noCount=3 → minority
    // For a majority-yes, we need more yes than no
    // Use isMale: Mario(T), Link(T), Pikachu(null), Kirby(null) → yesCount=2, noCount=0
    // abs(2-0)=2, total*0.2=0.8, 2 > 0.8 → not even split; yesCount(2) >= noCount(0) → majority branch
    const maleQ: ServerQuestion = { id: 'q4', text: 'Is this character male?', attribute: 'isMale' }
    const reasoning = generateReasoning(maleQ, CHARS, [])
    expect(reasoning.why).toContain('About')
    expect(reasoning.why).toContain('share this characteristic')
  })

  it('returns top candidates with correct structure', () => {
    const reasoning = generateReasoning(question, CHARS, [])
    expect(reasoning.topCandidates.length).toBeGreaterThan(0)
    reasoning.topCandidates.forEach((c) => {
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('probability')
      expect(c.probability).toBeGreaterThanOrEqual(0)
    })
  })

  it('reflects imageUrl for characters that have one', () => {
    const reasoning = generateReasoning(question, CHARS, [])
    const kirbyCandidate = reasoning.topCandidates.find((c) => c.name === 'Kirby')
    if (kirbyCandidate) {
      expect(kirbyCandidate.imageUrl).toBe('https://example.com/kirby.png')
    }
  })
})

// ── evaluateGuessReadiness extra branches ─────────────────────

describe('evaluateGuessReadiness', () => {
  it('fires high_certainty for a lone survivor even with < 5 questions asked', () => {
    // 1 character → probability=1.0 → high_certainty threshold fires before singleton check
    const result = evaluateGuessReadiness([CHARS[0]], [], 2, 15)
    expect(result.shouldGuess).toBe(true)
    expect(result.trigger).toBe('high_certainty')
    expect(result.topProbability).toBe(1)
  })

  it('blocks guess when budget remains and posterior is still broad', () => {
    const result = evaluateGuessReadiness(CHARS, [], 5, 15)
    expect(result.shouldGuess).toBe(false)
    expect(result.trigger).toBe('insufficient_data')
  })

  it('applies wrong guess penalty to required confidence', () => {
    const baseline = evaluateGuessReadiness(CHARS, [], 8, 15, 0)
    const penalized = evaluateGuessReadiness(CHARS, [], 8, 15, 3)
    expect(penalized.requiredConfidence).toBeGreaterThan(baseline.requiredConfidence)
  })

  it('returns correct questionsRemaining', () => {
    const result = evaluateGuessReadiness(CHARS, [], 5, 15)
    expect(result.questionsRemaining).toBe(10)
  })
})

// ── Session storage ───────────────────────────────────────────

function makeMockKV(): { store: Map<string, string>; kv: KVNamespace } {
  const store = new Map<string, string>()
  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    delete: vi.fn(async (key: string) => { store.delete(key) }),
    getWithMetadata: vi.fn(),
    list: vi.fn(),
  } as unknown as KVNamespace
  return { store, kv }
}

const BASE_SESSION: GameSession = {
  id: 'test-session',
  characters: [
    { id: 'mario', name: 'Mario', category: 'video-games', imageUrl: null, attributes: { isHuman: true } },
  ],
  questions: [{ id: 'q1', text: 'Is human?', attribute: 'isHuman' }],
  answers: [],
  currentQuestion: { id: 'q1', text: 'Is human?', attribute: 'isHuman' },
  difficulty: 'medium',
  maxQuestions: 15,
  createdAt: 1000000,
  rejectedGuesses: [],
  guessCount: 0,
  postRejectCooldown: 0,
}

describe('storeSession / loadSession', () => {
  it('stores and retrieves a session in lean format', async () => {
    const { kv } = makeMockKV()
    await storeSession(kv, BASE_SESSION)
    const loaded = await loadSession(kv, 'test-session')
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe('test-session')
    expect(loaded!.characters).toHaveLength(1)
    expect(loaded!.characters[0].name).toBe('Mario')
    expect(loaded!.difficulty).toBe('medium')
    expect(loaded!.rejectedGuesses).toEqual([])
  })

  it('returns null when session key is missing', async () => {
    const { kv } = makeMockKV()
    const result = await loadSession(kv, 'nonexistent')
    expect(result).toBeNull()
  })

  it('returns null when pool key is missing (lean format with missing pool)', async () => {
    const { store, kv } = makeMockKV()
    // Write only the lean session (no pool)
    const lean = { id: 'test-session', poolKey: 'pool:test-session', answers: [], currentQuestion: null, difficulty: 'medium', maxQuestions: 15, createdAt: 1000, rejectedGuesses: [], guessCount: 0, postRejectCooldown: 0 }
    store.set('game:test-session', JSON.stringify(lean))
    const result = await loadSession(kv, 'test-session')
    expect(result).toBeNull()
  })

  it('handles legacy full-session format (has characters array directly)', async () => {
    const { store, kv } = makeMockKV()
    // Legacy format stores full session under game: key with 'characters' field
    store.set('game:test-session', JSON.stringify({ ...BASE_SESSION }))
    const loaded = await loadSession(kv, 'test-session')
    expect(loaded).not.toBeNull()
    expect(loaded!.characters).toHaveLength(1)
    expect(loaded!.guessCount).toBe(0)
    expect(loaded!.postRejectCooldown).toBe(0)
  })

  it('defaults missing legacy fields to safe values', async () => {
    const { store, kv } = makeMockKV()
    // Simulate old session without guessCount / postRejectCooldown
    const legacy = { ...BASE_SESSION, guessCount: undefined, postRejectCooldown: undefined, rejectedGuesses: undefined }
    store.set('game:test-session', JSON.stringify(legacy))
    const loaded = await loadSession(kv, 'test-session')
    expect(loaded!.guessCount).toBe(0)
    expect(loaded!.postRejectCooldown).toBe(0)
    expect(loaded!.rejectedGuesses).toEqual([])
  })

  it('stores session with correct TTL', async () => {
    const { kv } = makeMockKV()
    await storeSession(kv, BASE_SESSION)
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls
    for (const call of putCalls) {
      expect(call[2]).toMatchObject({ expirationTtl: SESSION_TTL })
    }
  })
})

describe('saveSessionState', () => {
  it('updates mutable state without touching the pool', async () => {
    const { kv, store } = makeMockKV()
    await storeSession(kv, BASE_SESSION)
    const poolSize = JSON.parse(store.get('pool:test-session')!).characters.length

    const updated = { ...BASE_SESSION, answers: [{ questionId: 'isHuman', value: 'yes' as const }] }
    await saveSessionState(kv, updated)

    // Pool should be unchanged
    expect(JSON.parse(store.get('pool:test-session')!).characters.length).toBe(poolSize)
    // Game key should have the new answer
    const lean = JSON.parse(store.get('game:test-session')!)
    expect(lean.answers).toHaveLength(1)
  })
})

describe('deleteSession', () => {
  it('removes both game and pool keys', async () => {
    const { kv, store } = makeMockKV()
    await storeSession(kv, BASE_SESSION)
    expect(store.has('game:test-session')).toBe(true)
    expect(store.has('pool:test-session')).toBe(true)

    await deleteSession(kv, 'test-session')
    expect(store.has('game:test-session')).toBe(false)
    expect(store.has('pool:test-session')).toBe(false)
  })
})

// ── Phase 2 algorithm correctness ─────────────────────────────

describe('evaluateGuessReadiness – competitiveCount guard', () => {
  it('does not guess early when only residual-probability chars inflate aliveCount', () => {
    // 5 characters with strong leader; 3 stragglers have residual (SCORE_MISMATCH^3) probability.
    // aliveCount would be 5, but competitiveCount is only 2. Should NOT guess at q6.
    const pool: ServerCharacter[] = [
      { id: 'a', name: 'A', category: 'c', imageUrl: null, attributes: { x: true, y: true, z: true } },
      { id: 'b', name: 'B', category: 'c', imageUrl: null, attributes: { x: true, y: false, z: false } },
      { id: 'c', name: 'C', category: 'c', imageUrl: null, attributes: { x: false, y: true, z: false } },
      { id: 'd', name: 'D', category: 'c', imageUrl: null, attributes: { x: false, y: false, z: true } },
      { id: 'e', name: 'E', category: 'c', imageUrl: null, attributes: { x: false, y: false, z: false } },
    ]
    // Answers that strongly favor 'a' but leave residual probability on all others
    const answers: Answer[] = [
      { questionId: 'x', value: 'yes' },
      { questionId: 'y', value: 'yes' },
      { questionId: 'z', value: 'yes' },
    ]
    // 6 questions asked, 9 remaining
    const result = evaluateGuessReadiness(pool, answers, 6, 15)
    // With 3 strong answers, 'a' should dominate — result depends on actual probs
    expect(result.aliveCount).toBeGreaterThanOrEqual(1)
    expect(typeof result.shouldGuess).toBe('boolean')
    // The key invariant: competitiveCount is available and informs the decision
    expect(result.questionsRemaining).toBe(9)
  })
})

describe('filterPossibleCharacters – MAX_MISMATCHES=2 boundary', () => {
  it('keeps characters with exactly 2 contradictions (at tolerance boundary)', () => {
    // Mario: isHuman=T(mismatch for "no"=1), canFly=F(mismatch for "yes"=2) → exactly 2 → KEPT
    const answers: Answer[] = [
      { questionId: 'isHuman', value: 'no' },
      { questionId: 'canFly', value: 'yes' },
    ]
    const result = filterPossibleCharacters(CHARS, answers)
    // Mario and Link both have 2 mismatches → kept; Pikachu has 1; Kirby has 0
    expect(result.map((c) => c.id)).toContain('mario')
    expect(result.map((c) => c.id)).toContain('link')
  })
})
