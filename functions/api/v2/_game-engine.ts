// Server-side game engine — ported from src/lib/gameEngine.ts
// Bayesian scoring with information gain question selection

// ── Scoring constants (mirrored from src/lib/constants.ts) ──
const SCORE_MATCH = 1
const SCORE_MISMATCH = 0
const SCORE_UNKNOWN = 0.5
const SCORE_MAYBE = 0.7
const SCORE_MAYBE_MISS = 0.3

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

// ── Engine Functions ─────────────────────────────────────────

/** Score a single answer against a character's attribute value. */
function scoreForAnswer(answerValue: AnswerValue, characterValue: boolean | null | undefined): number {
  if (answerValue === 'yes') {
    if (characterValue === true) return SCORE_MATCH
    if (characterValue === false) return SCORE_MISMATCH
    return SCORE_UNKNOWN
  }
  if (answerValue === 'no') {
    if (characterValue === false) return SCORE_MATCH
    if (characterValue === true) return SCORE_MISMATCH
    return SCORE_UNKNOWN
  }
  if (answerValue === 'maybe') {
    if (characterValue === true) return SCORE_MAYBE
    if (characterValue === false) return SCORE_MAYBE_MISS
    return SCORE_UNKNOWN
  }
  return 1 // 'unknown' → no effect
}

/** Compute Bayesian-style probability for each character given answers. */
export function calculateProbabilities(
  characters: ServerCharacter[],
  answers: Answer[]
): Map<string, number> {
  const probabilities = new Map<string, number>()

  for (const character of characters) {
    let score = 1

    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId]
      score *= scoreForAnswer(answer.value, characterValue)
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

/** Pick the question with the highest expected information gain. */
export function selectBestQuestion(
  characters: ServerCharacter[],
  answers: Answer[],
  allQuestions: ServerQuestion[]
): ServerQuestion | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  const probs = calculateProbabilities(characters, answers)

  const sortedProbs = Array.from(probs.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length))
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0)
  const topNChars = topN.map(([id]) => characters.find((c) => c.id === id)).filter(Boolean)

  let bestQuestion: ServerQuestion | null = null
  let bestScore = -1

  const currentProbs = characters.map((c) => probs.get(c.id) || 0)
  const currentEntropy = entropy(currentProbs)

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

    let expectedEntropy = 0

    const pUnknown = unknownProbs.reduce((s, p) => s + p, 0)
    const yesTotal = pYes + pUnknown * 0.5
    if (yesTotal > 0) {
      const yesGroupProbs = [
        ...yesProbs.map((p) => p / yesTotal),
        ...unknownProbs.map((p) => (p * 0.5) / yesTotal),
      ]
      expectedEntropy += yesTotal * entropy(yesGroupProbs)
    }

    const noTotal = pNo + pUnknown * 0.5
    if (noTotal > 0) {
      const noGroupProbs = [
        ...noProbs.map((p) => p / noTotal),
        ...unknownProbs.map((p) => (p * 0.5) / noTotal),
      ]
      expectedEntropy += noTotal * entropy(noGroupProbs)
    }

    let infoGain = currentEntropy - expectedEntropy

    // Coverage penalty for sparse attributes
    const nullCount = characters.filter((c) => c.attributes[question.attribute] == null).length
    const nullRatio = nullCount / characters.length
    if (nullRatio > 0.6) {
      infoGain *= 1 - (nullRatio - 0.6)
    }

    // Differentiation boost for top-N candidates
    if (topNMass > 0.6 && topNChars.length >= 2) {
      const topValues = new Set(topNChars.map((c) => c.attributes[question.attribute]))
      if (topValues.has(true) && topValues.has(false)) {
        infoGain *= 1 + 0.5 * topNMass
      }
    }

    if (infoGain > bestScore) {
      bestScore = infoGain
      bestQuestion = question
    }
  }

  return bestQuestion
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

/** Should the AI guess now? Progressive confidence thresholds. */
export function shouldMakeGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number
): boolean {
  if (characters.length <= 1) return true

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a)
  const topProbability = sorted[0]

  if (questionCount >= maxQuestions) return true
  if (topProbability > 0.8) return true

  const aliveCount = sorted.filter((p) => p > 0).length
  if (aliveCount <= 2 && questionCount >= 3 && topProbability >= 0.5) return true

  const progress = questionCount / maxQuestions
  if (progress >= 0.75 && topProbability > 0.45) return true
  if (progress >= 0.5 && topProbability > 0.65) return true

  const halfwayPoint = Math.floor(maxQuestions / 2)
  const secondProbability = sorted.length > 1 ? sorted[1] : 0
  const gap = topProbability - secondProbability
  if (questionCount >= halfwayPoint && gap > 0.3 && topProbability > 0.5) return true

  return false
}

/** Get the best guess character. */
export function getBestGuess(characters: ServerCharacter[], answers: Answer[]): ServerCharacter | null {
  if (characters.length === 0) return null

  const probabilities = calculateProbabilities(characters, answers)
  const sorted = Array.from(probabilities.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const bestId = sorted[0][0]
  return characters.find((c) => c.id === bestId) || characters[0]
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

/** Hard-filter characters based on definitive answers. */
export function filterPossibleCharacters(
  characters: ServerCharacter[],
  answers: Answer[]
): ServerCharacter[] {
  return characters.filter((char) => {
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
  if ('characters' in data) return data as GameSession

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
