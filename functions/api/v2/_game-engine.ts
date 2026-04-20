// Server-side game engine — mirrored from src/lib/gameEngine.ts
// Bayesian scoring with information gain question selection

// ── Scoring constants (mirrored from src/lib/constants.ts) ──
const SCORE_MATCH = 1
const SCORE_MISMATCH = 0
const SCORE_UNKNOWN = 0.5
const SCORE_MAYBE = 0.7
const SCORE_MAYBE_MISS = 0.3
const MAYBE_ANSWER_PROB = 0.15
const ALIVE_THRESHOLD = 0.001

// ── Types ────────────────────────────────────────────────────

export type AnswerValue = 'yes' | 'no' | 'maybe' | 'unknown'

export interface Answer {
  questionId: string  // attribute key
  value: AnswerValue
}

export interface ServerCharacter {
  id: string
  name: string
  category: string
  imageUrl: string | null
  attributes: Record<string, boolean | null>
}

export interface ServerQuestion {
  id: string
  text: string
  attribute: string
  displayText?: string
  category?: string
}

export interface ScoringOptions {
  coverageMap?: Map<string, number>
  popularityMap?: Map<string, number>
}

export interface QuestionSelectionOptions {
  progress?: number
  recentCategories?: string[]
  scoring?: ScoringOptions
}

export interface GuessAnalytics {
  confidence: number
  entropy: number
  remaining: number
  answerDistribution: Record<string, number>
}

export interface ReasoningExplanation {
  why: string
  impact: string
  remaining: number
  confidence: number
  topCandidates: Array<{ name: string; probability: number; imageUrl?: string | null }>
}

export interface GameSession {
  id: string
  characters: ServerCharacter[]
  questions: ServerQuestion[]
  answers: Answer[]
  currentQuestion: ServerQuestion | null
  difficulty: string
  maxQuestions: number
  createdAt: number
  rejectedGuesses: string[]
  guessCount: number
  guessAnalytics?: GuessAnalytics
}

// ── Constants ────────────────────────────────────────────────

export const POOL_SIZE = 500
export const MIN_ATTRIBUTES = 5
export const SESSION_TTL = 3600 // 1 hour

export const DIFFICULTY_MAP: Record<string, number> = {
  easy: 20,
  medium: 15,
  hard: 10,
}

export const VALID_ANSWERS = new Set<string>(['yes', 'no', 'maybe', 'unknown'])

/** Bonus questions granted per rejected guess. Hard cap at base × 2. */
export const BONUS_QUESTIONS_PER_REJECT: Record<string, number> = {
  easy: 3,
  medium: 2,
  hard: 2,
}

// ── Engine Functions ─────────────────────────────────────────

/** Score a single answer against a character's attribute value. */
function scoreForAnswer(
  answerValue: AnswerValue,
  characterValue: boolean | null | undefined,
  effectiveUnknown: number = SCORE_UNKNOWN
): number {
  if (answerValue === 'yes') {
    if (characterValue === true) return SCORE_MATCH
    if (characterValue === false) return SCORE_MISMATCH
    return effectiveUnknown
  }
  if (answerValue === 'no') {
    if (characterValue === false) return SCORE_MATCH
    if (characterValue === true) return SCORE_MISMATCH
    return effectiveUnknown
  }
  if (answerValue === 'maybe') {
    if (characterValue === true) return SCORE_MAYBE
    if (characterValue === false) return SCORE_MAYBE_MISS
    return effectiveUnknown
  }
  return 1 // 'unknown' → no effect
}

/** Compute Bayesian-style probability for each character given answers.
 *  Supports coverage-weighted null scoring and popularity priors. */
export function calculateProbabilities(
  characters: ServerCharacter[],
  answers: Answer[],
  options?: ScoringOptions
): Map<string, number> {
  const probabilities = new Map<string, number>()
  const { coverageMap, popularityMap } = options ?? {}

  for (const character of characters) {
    // Weak popularity prior: 1.0 (unknown) to 1.1 (most popular)
    let score = popularityMap
      ? 1.0 + 0.1 * (popularityMap.get(character.id) ?? 0)
      : 1

    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId]
      // Coverage-weighted unknown score: sparse attributes score lower (0.3–0.7)
      const effectiveUnknown = coverageMap
        ? 0.3 + 0.4 * (coverageMap.get(answer.questionId) ?? 0.5)
        : SCORE_UNKNOWN
      score *= scoreForAnswer(answer.value, characterValue, effectiveUnknown)
    }

    probabilities.set(character.id, score)
  }

  const totalScore = Array.from(probabilities.values()).reduce((a, b) => a + b, 0)
  if (totalScore > 0) {
    for (const [id, score] of probabilities) {
      probabilities.set(id, score / totalScore)
    }
  }

  return probabilities
}

function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, p) => {
    if (p <= 0) return sum
    return sum - p * Math.log2(p)
  }, 0)
}

/** Pick the question with the highest expected information gain.
 *  Enhanced with: sigmoid coverage penalty, three-way entropy (yes/no/maybe),
 *  top-N differentiation, category diversity, and dynamic top-K variety. */
export function selectBestQuestion(
  characters: ServerCharacter[],
  answers: Answer[],
  allQuestions: ServerQuestion[],
  options?: QuestionSelectionOptions
): ServerQuestion | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  const probs = calculateProbabilities(characters, answers, options?.scoring)

  const sortedProbs = Array.from(probs.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length))
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0)
  const topNChars = topN.map(([id]) => characters.find((c) => c.id === id)).filter(Boolean)

  const currentProbs = characters.map((c) => probs.get(c.id) || 0)
  const currentEntropy = entropy(currentProbs)
  const scored: Array<{ question: ServerQuestion; score: number }> = []

  for (const question of availableQuestions) {
    let pYes = 0
    let pNo = 0
    const yesProbs: number[] = []
    const noProbs: number[] = []
    const unknownProbs: number[] = []

    for (const c of characters) {
      const prob = probs.get(c.id) || 0
      const attr = c.attributes[question.attribute]
      if (attr === true) {
        pYes += prob
        yesProbs.push(prob)
      } else if (attr === false) {
        pNo += prob
        noProbs.push(prob)
      } else {
        unknownProbs.push(prob)
      }
    }

    // Three-way expected entropy: yes/no/maybe partitions
    let expectedEntropy = 0

    const pUnknown = unknownProbs.reduce((s, p) => s + p, 0)
    const yesTotal = pYes + pUnknown * 0.5
    const noTotal = pNo + pUnknown * 0.5

    // Adjusted weights to account for maybe answers (~15% probability)
    const adjustedYes = yesTotal * (1 - MAYBE_ANSWER_PROB)
    const adjustedNo = noTotal * (1 - MAYBE_ANSWER_PROB)

    if (adjustedYes > 0) {
      const yesGroupProbs = [
        ...yesProbs.map((p) => p / yesTotal),
        ...unknownProbs.map((p) => (p * 0.5) / yesTotal),
      ]
      expectedEntropy += adjustedYes * entropy(yesGroupProbs)
    }

    if (adjustedNo > 0) {
      const noGroupProbs = [
        ...noProbs.map((p) => p / noTotal),
        ...unknownProbs.map((p) => (p * 0.5) / noTotal),
      ]
      expectedEntropy += adjustedNo * entropy(noGroupProbs)
    }

    // Maybe partition: all characters contribute with soft weights
    let maybeSum = 0
    const maybeWeighted: number[] = []
    for (const c of characters) {
      const prob = probs.get(c.id) || 0
      const attr = c.attributes[question.attribute]
      const w = attr === true ? SCORE_MAYBE : attr === false ? SCORE_MAYBE_MISS : SCORE_UNKNOWN
      const wp = prob * w
      maybeWeighted.push(wp)
      maybeSum += wp
    }
    if (maybeSum > 0) {
      const maybeGroupProbs = maybeWeighted.map((p) => p / maybeSum)
      expectedEntropy += MAYBE_ANSWER_PROB * entropy(maybeGroupProbs)
    }

    let infoGain = currentEntropy - expectedEntropy

    // Smooth sigmoid coverage penalty (replaces discontinuous step at 60%)
    const nullCount = characters.filter((c) => c.attributes[question.attribute] == null).length
    const nullRatio = nullCount / characters.length
    const coveragePenalty = 1 / (1 + Math.exp(10 * (nullRatio - 0.5)))
    infoGain *= coveragePenalty

    // Differentiation boost for top-N candidates
    if (topNMass > 0.6 && topNChars.length >= 2) {
      const topValues = new Set(topNChars.map((c) => c.attributes[question.attribute]))
      if (topValues.has(true) && topValues.has(false)) {
        infoGain *= 1 + 0.5 * topNMass
      }
    }

    // Category diversity penalty: avoid consecutive questions in the same category
    if (options?.recentCategories?.length && question.category) {
      if (options.recentCategories.includes(question.category)) {
        infoGain *= 0.8
      }
    }

    scored.push({ question, score: infoGain })
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => b.score - a.score)
  if (scored[0].score <= 0) return scored[0].question

  // Dynamic top-K threshold: more variety early, more optimal late
  const progress = options?.progress ?? 0
  const thresholdFactor = 0.5 + 0.4 * progress // 0.5 early → 0.9 late
  const threshold = scored[0].score * thresholdFactor
  const topK = scored.filter((s) => s.score >= threshold)
  const totalWeight = topK.reduce((sum, s) => sum + s.score, 0)
  let random = Math.random() * totalWeight
  for (const candidate of topK) {
    random -= candidate.score
    if (random <= 0) return candidate.question
  }

  return topK[0].question
}

/** Build reasoning explanation for a question. */
export function generateReasoning(
  question: ServerQuestion,
  characters: ServerCharacter[],
  answers: Answer[]
): ReasoningExplanation {
  const total = characters.length
  const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length
  const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])

  const topCharacter = sorted[0]
  const confidence = topCharacter ? topCharacter[1] * 100 : 0

  const topCandidates = sorted.slice(0, 5).map(([id, p]) => {
    const char = characters.find((c) => c.id === id)
    return {
      name: char?.name ?? id,
      probability: Math.round(p * 100),
      imageUrl: char?.imageUrl ?? null,
    }
  })

  const yesPercent = Math.round((yesCount / total) * 100)
  const noPercent = Math.round((noCount / total) * 100)

  let why: string
  if (Math.abs(yesCount - noCount) < total * 0.2) {
    why = `This question splits the possibilities almost perfectly: ${yesPercent}% could answer "yes" while ${noPercent}% would say "no". This is an optimal binary split.`
  } else if (yesCount < noCount) {
    why = `Only ${yesPercent}% of remaining possibilities have this trait. A "yes" answer dramatically narrows options.`
  } else {
    why = `About ${yesPercent}% of remaining possibilities share this characteristic.`
  }

  const eliminateYes = noCount
  const eliminateNo = yesCount
  const impact = `"Yes" eliminates ${eliminateYes} (${Math.round((eliminateYes / total) * 100)}%), "No" eliminates ${eliminateNo} (${Math.round((eliminateNo / total) * 100)}%).`

  return { why, impact, remaining: total, confidence: Math.round(confidence), topCandidates }
}

/** Should the AI guess now? Continuous quadratic confidence curve with
 *  entropy-based triggers and confidence escalation after wrong guesses. */
export function shouldMakeGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses: number = 0
): boolean {
  if (characters.length <= 1) return true

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a)
  const topProbability = sorted[0]

  // Hard limit
  if (questionCount >= maxQuestions) return true

  // Confidence escalation: +0.1 per wrong guess, capped at +0.3
  const escalation = Math.min(priorWrongGuesses * 0.1, 0.3)

  // Continuous progressive threshold: quadratic decay
  // progress=0: 0.8 | progress=0.5: 0.7 | progress=0.75: 0.575 | progress=1: 0.4
  const progress = questionCount / maxQuestions
  const requiredConfidence = Math.min(0.8 - 0.4 * progress * progress + escalation, 0.95)
  if (topProbability > requiredConfidence) return true

  // Count effectively alive candidates (above noise floor)
  const aliveCount = sorted.filter((p) => p > ALIVE_THRESHOLD).length
  if (aliveCount <= 2 && questionCount >= 3 && topProbability >= Math.min(0.5 + escalation, 0.95))
    return true

  // Entropy-based trigger: if distribution is very narrow (~2 candidates), guess
  const aliveProbs = sorted.filter((p) => p > ALIVE_THRESHOLD)
  const currentEntropy = entropy(aliveProbs)
  const entropyThreshold = 1.0 - escalation // 1.0 base → 0.7 after 3+ wrongs
  if (currentEntropy < entropyThreshold && questionCount >= 3) return true

  // Continuous gap-based guessing: required gap decreases with progress
  const secondProbability = sorted.length > 1 ? sorted[1] : 0
  const gap = topProbability - secondProbability
  const requiredGap = 0.4 - 0.2 * progress // 0.4 early → 0.2 late
  if (gap > requiredGap && topProbability > Math.min(0.4 + escalation, 0.95)) return true

  return false
}

/** Get the best guess character, excluding previously rejected guesses. */
export function getBestGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = []
): ServerCharacter | null {
  if (characters.length === 0) return null

  const rejectedSet = new Set(rejectedGuesses)
  const eligible = characters.filter((c) => !rejectedSet.has(c.id))
  if (eligible.length === 0) return null

  const probabilities = calculateProbabilities(eligible, answers)
  const sorted = Array.from(probabilities.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const bestId = sorted[0][0]
  return eligible.find((c) => c.id === bestId) || eligible[0]
}

/** Check for contradictions (all characters eliminated). */
export function detectContradictions(
  characters: ServerCharacter[],
  answers: Answer[]
): { hasContradiction: boolean; remainingCount: number } {
  if (answers.length === 0) return { hasContradiction: false, remainingCount: characters.length }

  const probabilities = calculateProbabilities(characters, answers)
  const remaining = Array.from(probabilities.values()).filter((p) => p > 0).length

  return { hasContradiction: remaining === 0, remainingCount: remaining }
}

/** Hard-filter characters based on definitive answers and rejected guesses. */
export function filterPossibleCharacters(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = []
): ServerCharacter[] {
  const rejectedSet = new Set(rejectedGuesses)
  return characters.filter((char) => {
    if (rejectedSet.has(char.id)) return false
    for (const answer of answers) {
      const attr = char.attributes[answer.questionId]
      if (answer.value === 'yes' && attr === false) return false
      if (answer.value === 'no' && attr === true) return false
    }
    return true
  })
}

// ── Session storage (split pool / mutable state) ─────────────
// The immutable pool (characters + questions) is stored separately
// so that each answer only rewrites the small mutable session.

interface LeanSession {
  id: string
  poolKey: string
  answers: Answer[]
  currentQuestion: ServerQuestion | null
  difficulty: string
  maxQuestions: number
  createdAt: number
  rejectedGuesses?: string[]
  guessCount?: number
  guessAnalytics?: GuessAnalytics
}

interface GamePool {
  characters: ServerCharacter[]
  questions: ServerQuestion[]
}

/** Store a new session — writes both pool (immutable) and lean session (mutable). */
export async function storeSession(kv: KVNamespace, session: GameSession): Promise<void> {
  const poolKey = `pool:${session.id}`
  const pool: GamePool = { characters: session.characters, questions: session.questions }
  const lean: LeanSession = {
    id: session.id,
    poolKey,
    answers: session.answers,
    currentQuestion: session.currentQuestion,
    difficulty: session.difficulty,
    maxQuestions: session.maxQuestions,
    createdAt: session.createdAt,
    rejectedGuesses: session.rejectedGuesses,
    guessCount: session.guessCount,
    guessAnalytics: session.guessAnalytics,
  }
  await Promise.all([
    kv.put(poolKey, JSON.stringify(pool), { expirationTtl: SESSION_TTL }),
    kv.put(`game:${session.id}`, JSON.stringify(lean), { expirationTtl: SESSION_TTL }),
  ])
}

/** Load a session from KV — handles both legacy (full) and new (lean + pool) formats. */
export async function loadSession(kv: KVNamespace, sessionId: string): Promise<GameSession | null> {
  const raw = await kv.get(`game:${sessionId}`)
  if (!raw) return null

  const data = JSON.parse(raw) as LeanSession | GameSession

  // Legacy full session (has 'characters' array directly)
  if ('characters' in data) {
    const legacy = data as GameSession
    return { ...legacy, rejectedGuesses: legacy.rejectedGuesses ?? [], guessCount: legacy.guessCount ?? 0 }
  }

  // New lean format — load pool separately
  const poolStr = await kv.get(data.poolKey)
  if (!poolStr) return null
  const pool = JSON.parse(poolStr) as GamePool

  return {
    id: data.id,
    characters: pool.characters,
    questions: pool.questions,
    answers: data.answers,
    currentQuestion: data.currentQuestion,
    difficulty: data.difficulty,
    maxQuestions: data.maxQuestions,
    createdAt: data.createdAt,
    rejectedGuesses: data.rejectedGuesses ?? [],
    guessCount: data.guessCount ?? 0,
    guessAnalytics: data.guessAnalytics,
  }
}

/** Save only mutable session state (answers + currentQuestion). Much smaller write. */
export async function saveSessionState(kv: KVNamespace, session: GameSession): Promise<void> {
  const lean: LeanSession = {
    id: session.id,
    poolKey: `pool:${session.id}`,
    answers: session.answers,
    currentQuestion: session.currentQuestion,
    difficulty: session.difficulty,
    maxQuestions: session.maxQuestions,
    createdAt: session.createdAt,
    rejectedGuesses: session.rejectedGuesses,
    guessCount: session.guessCount,
    guessAnalytics: session.guessAnalytics,
  }
  await kv.put(`game:${session.id}`, JSON.stringify(lean), { expirationTtl: SESSION_TTL })
}

/** Delete a session and its pool from KV. */
export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  await Promise.all([
    kv.delete(`game:${sessionId}`),
    kv.delete(`pool:${sessionId}`),
  ])
}
