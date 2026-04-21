// Server-side game engine — mirrored from src/lib/gameEngine.ts
// Bayesian scoring with information gain question selection

// ── Scoring constants (mirrored from src/lib/constants.ts) ──
const SCORE_MATCH = 1
const SCORE_MISMATCH = 0.05  // Non-zero: resilient to 1-2 bad attribute values or user errors
const SCORE_UNKNOWN = 0.35  // lower than 0.5 to penalize characters with sparse attribute coverage
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
  /** Game progress (0–1). Decays the popularity prior (full weight at 0, neutral at 1). */
  progress?: number
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
  trigger?: GuessTrigger
  forced?: boolean
  gap?: number
  aliveCount?: number
  questionsRemaining?: number
}

export type GuessTrigger =
  | 'singleton'
  | 'max_questions'
  | 'high_certainty'
  | 'strict_readiness'
  | 'insufficient_data'

export interface GuessReadiness {
  shouldGuess: boolean
  forced: boolean
  trigger: GuessTrigger
  topProbability: number
  secondProbability: number
  gap: number
  entropy: number
  aliveCount: number
  questionsRemaining: number
  requiredConfidence: number
  requiredGap: number
  requiredEntropy: number
  blockedByRejectCooldown: boolean
  rejectCooldownRemaining: number
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
  postRejectCooldown: number
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
    // Popularity prior decays with game progress: full strength early → neutral at game end
    const priorStrength = options?.progress !== undefined ? 1 - options.progress : 1
    let score = popularityMap
      ? 1.0 + 0.1 * priorStrength * (popularityMap.get(character.id) ?? 0)
      : 1

    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId]
      // Coverage-weighted unknown score: sparse attributes score lower (0.3–0.7)
      const effectiveUnknown = coverageMap
        ? 0.3 + 0.4 * (coverageMap.get(answer.questionId) ?? 0.5)
        : SCORE_UNKNOWN
      score *= scoreForAnswer(answer.value, characterValue, effectiveUnknown)
      // Early exit: once negligibly probable, skip remaining answers
      if (score < 1e-8) { score = 0; break }
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

function calculateTopCandidateSeparation(
  topChars: ServerCharacter[],
  probs: Map<string, number>,
  attribute: string,
): { separation: number; coverage: number } {
  if (topChars.length < 2) {
    return { separation: 0, coverage: 0 }
  }

  let weightedSeparation = 0
  let totalWeight = 0
  let knownTopCandidates = 0

  for (const char of topChars) {
    if (char.attributes[attribute] != null) knownTopCandidates += 1
  }

  for (let index = 0; index < topChars.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < topChars.length; compareIndex += 1) {
      const left = topChars[index]
      const right = topChars[compareIndex]
      const pairWeight = (probs.get(left.id) ?? 0) * (probs.get(right.id) ?? 0)
      if (pairWeight <= 0) continue

      totalWeight += pairWeight

      const leftValue = left.attributes[attribute]
      const rightValue = right.attributes[attribute]
      if (leftValue == null && rightValue == null) continue
      if (leftValue == null || rightValue == null) {
        weightedSeparation += pairWeight * 0.35
        continue
      }
      if (leftValue !== rightValue) {
        weightedSeparation += pairWeight
      }
    }
  }

  return {
    separation: totalWeight > 0 ? weightedSeparation / totalWeight : 0,
    coverage: knownTopCandidates / topChars.length,
  }
}

/** Map an attribute key to a semantic group for diversity tracking. */
function getAttributeGroup(attribute: string): string {
  if (attribute.startsWith('can') || attribute === 'climbsWalls' || attribute === 'controlsWeather' || attribute === 'shootsLasers') return 'ability'
  if (attribute.startsWith('has')) return 'possession'
  if (attribute.startsWith('wears')) return 'appearance'
  if (attribute.startsWith('isFrom') || attribute.startsWith('from') || attribute.startsWith('livesIn')) return 'origin'
  if (/^is(Alien|Animal|Cyborg|Demon|Dwarf|Elf|Ghost|Giant|God|Human|Immortal|Mythical|Orc|Robot|Supernatural|Vampire|Wizard|Zombie|Bald|Blind|Deaf|Disabled|Mute|Invisible)$/.test(attribute)) return 'species'
  if (/^is(Female|Male|GenderFluid|NonBinary|Transgender|Teenager)$/.test(attribute)) return 'identity'
  if (/^is(Antagonist|Assassin|Detective|Hero|Knight|Leader|Mentor|Ninja|Pirate|Protagonist|Royalty|Samurai|Sidekick|Villain|Scientist|Engineer|Traitor)$/.test(attribute)) return 'role'
  if (/^is(Adventurous|Brave|Charming|Clumsy|Cowardly|Creative|Cruel|Cunning|Curious|Devious|Energetic|Foolish|Funny|Greedy|Honest|Humorous|Impatient|Intelligent|Kind|Lazy|Loyal|Naive|Optimistic|Patient|Pessimistic|Rebellious|Sarcastic|Serious|Skeptical|Wise|Iconic)$/.test(attribute)) return 'personality'
  return 'other'
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
  const topTwoChars = topNChars.slice(0, 2)

  const currentProbs = characters.map((c) => probs.get(c.id) || 0)
  const currentEntropy = entropy(currentProbs)
  const progress = options?.progress ?? 0
  const endgameFocus = progress >= 0.65 || topNMass >= 0.75
  const recentAttrGroups = new Set(answers.slice(-3).map((a) => getAttributeGroup(a.questionId)))
  const scored: Array<{ question: ServerQuestion; score: number; topTwoSplit: boolean }> = []

  // Pre-compute null ratios for coverage penalty (avoids O(Q×C) re-scan inside the loop)
  const nullRatioMap = new Map<string, number>()
  for (const q of availableQuestions) {
    let nullCount = 0
    for (const c of characters) {
      if (c.attributes[q.attribute] == null) nullCount++
    }
    nullRatioMap.set(q.attribute, nullCount / characters.length)
  }

  for (const question of availableQuestions) {
    let pYes = 0
    let pNo = 0
    const yesProbs: number[] = []
    const noProbs: number[] = []
    const unknownProbs: number[] = []
    let maybeSum = 0
    const maybeWeighted: number[] = []

    for (const c of characters) {
      const prob = probs.get(c.id) || 0
      const attr = c.attributes[question.attribute]
      if (attr === true) {
        pYes += prob
        yesProbs.push(prob)
        maybeWeighted.push(prob * SCORE_MAYBE)
        maybeSum += prob * SCORE_MAYBE
      } else if (attr === false) {
        pNo += prob
        noProbs.push(prob)
        maybeWeighted.push(prob * SCORE_MAYBE_MISS)
        maybeSum += prob * SCORE_MAYBE_MISS
      } else {
        unknownProbs.push(prob)
        maybeWeighted.push(prob * SCORE_UNKNOWN)
        maybeSum += prob * SCORE_UNKNOWN
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

    if (maybeSum > 0) {
      const maybeGroupProbs = maybeWeighted.map((p) => p / maybeSum)
      expectedEntropy += MAYBE_ANSWER_PROB * entropy(maybeGroupProbs)
    }

    let infoGain = currentEntropy - expectedEntropy

    // Smooth sigmoid coverage penalty (replaces discontinuous step at 60%)
    const nullRatio = nullRatioMap.get(question.attribute) ?? 0
    const coveragePenalty = 1 / (1 + Math.exp(10 * (nullRatio - 0.5)))
    infoGain *= coveragePenalty

    // Differentiation boost for top-N candidates (only before endgame; the endgame
    // path applies a more precise separation-based boost that supersedes this)
    if (!endgameFocus && topNMass > 0.6 && topNChars.length >= 2) {
      const topValues = new Set(topNChars.map((c) => c.attributes[question.attribute]))
      if (topValues.has(true) && topValues.has(false)) {
        infoGain *= 1 + 0.5 * topNMass
      }
    }

    let topTwoSplit = false

    if (endgameFocus && topNChars.length >= 2) {
      const { separation, coverage } = calculateTopCandidateSeparation(topNChars, probs, question.attribute)
      const focusStrength = 0.35 + 0.45 * progress
      infoGain *= 1 + focusStrength * separation * (0.6 + 0.4 * coverage)

      if (coverage < 0.5) {
        infoGain *= 0.8 + 0.4 * coverage
      }

      if (topTwoChars.length === 2) {
        const firstValue = topTwoChars[0].attributes[question.attribute]
        const secondValue = topTwoChars[1].attributes[question.attribute]

        if (firstValue != null && secondValue != null && firstValue !== secondValue) {
          topTwoSplit = true
          infoGain *= 1 + 0.9 * topNMass + 0.35 * progress
        } else if (firstValue == null || secondValue == null) {
          infoGain *= 0.78
        } else {
          infoGain *= 0.72
        }
      }
    }

    // Category diversity penalty: avoid consecutive questions in the same category
    if (options?.recentCategories?.length && question.category) {
      if (options.recentCategories.includes(question.category)) {
        infoGain *= 0.8
      }
    }

    // Attribute group diversity: penalise consecutive same-type questions (e.g. two ability questions in a row)
    const attrGroup = getAttributeGroup(question.attribute)
    if (attrGroup !== 'other' && recentAttrGroups.has(attrGroup)) {
      infoGain *= 0.75
    }

    scored.push({ question, score: infoGain, topTwoSplit })
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => b.score - a.score)
  if (scored[0].score <= 0) return scored[0].question

  if (endgameFocus && progress >= 0.85) {
    const bestTopTwoSplit = scored.find((candidate) => candidate.topTwoSplit)
    // Threshold scales down as turns run out: 0.55 at progress=0.85 → 0.40 at progress=1.0
    const splitThreshold = Math.max(0.55 - (progress - 0.85), 0.4)
    if (bestTopTwoSplit && bestTopTwoSplit.score >= scored[0].score * splitThreshold) {
      return bestTopTwoSplit.question
    }
    return scored[0].question
  }

  // Dynamic top-K threshold: more variety early, more optimal late
  // When endgame focus is active, cap the pool to avoid wasting turns on suboptimal questions
  const baseFactor = 0.3 + 0.6 * progress // 0.3 early → 0.9 late
  const thresholdFactor = endgameFocus ? Math.max(baseFactor, 0.8) : baseFactor
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
  priorWrongGuesses: number = 0,
  scoring?: ScoringOptions
): boolean {
  return evaluateGuessReadiness(characters, answers, questionCount, maxQuestions, priorWrongGuesses, scoring).shouldGuess
}

/** Determine whether the posterior is concentrated enough for a guess. */
export function evaluateGuessReadiness(
  characters: ServerCharacter[],
  answers: Answer[],
  questionCount: number,
  maxQuestions: number,
  priorWrongGuesses: number = 0,
  scoring?: ScoringOptions
): GuessReadiness {
  // 0 characters = full contradiction; always trigger a forced guess to surface it
  if (characters.length === 0) {
    return {
      shouldGuess: true,
      forced: true,
      trigger: 'singleton',
      topProbability: 0,
      secondProbability: 0,
      gap: 0,
      entropy: 0,
      aliveCount: 0,
      questionsRemaining: Math.max(0, maxQuestions - questionCount),
      requiredConfidence: 0,
      requiredGap: 0,
      requiredEntropy: 0,
      blockedByRejectCooldown: false,
      rejectCooldownRemaining: 0,
    }
  }

  // Singleton: only one character survives, but require a minimum of 5 questions
  // to avoid premature guesses from early bad eliminations.
  if (characters.length <= 1 && questionCount >= 5) {
    return {
      shouldGuess: true,
      forced: false,
      trigger: 'singleton',
      topProbability: 1,
      secondProbability: 0,
      gap: 1,
      entropy: 0,
      aliveCount: characters.length,
      questionsRemaining: Math.max(0, maxQuestions - questionCount),
      requiredConfidence: 0,
      requiredGap: 0,
      requiredEntropy: 0,
      blockedByRejectCooldown: false,
      rejectCooldownRemaining: 0,
    }
  }

  if (questionCount >= maxQuestions) {
    return {
      shouldGuess: true,
      forced: true,
      trigger: 'max_questions',
      topProbability: 0,
      secondProbability: 0,
      gap: 0,
      entropy: 0,
      aliveCount: characters.length,
      questionsRemaining: 0,
      requiredConfidence: 0,
      requiredGap: 0,
      requiredEntropy: 0,
      blockedByRejectCooldown: false,
      rejectCooldownRemaining: 0,
    }
  }

  const probabilities = calculateProbabilities(characters, answers, scoring)
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a)
  const topProbability = sorted[0] ?? 0
  const secondProbability = sorted[1] ?? 0
  const gap = topProbability - secondProbability

  const aliveProbs = sorted.filter((p) => p > ALIVE_THRESHOLD)
  const aliveCount = aliveProbs.length
  const currentEntropy = entropy(aliveProbs)
  // With SCORE_MISMATCH=0.05, tolerated 1-mismatch chars have residual probability that inflates
  // aliveCount. Use competitiveCount (chars with ≥15% of top probability) for readiness gates.
  // Hard floor of 0.01 prevents inflated competitiveCount in uniform low-probability pools
  const competitiveCount = aliveProbs.filter((p) => p >= topProbability * 0.15 && p > 0.01).length
  const questionsRemaining = Math.max(0, maxQuestions - questionCount)
  const progress = maxQuestions > 0 ? questionCount / maxQuestions : 1

  // Wrong guesses should make future guesses stricter, not more aggressive.
  const wrongGuessPenalty = Math.min(priorWrongGuesses * 0.04, 0.12)
  const requiredConfidence = Math.min(0.85 - 0.25 * progress * progress + wrongGuessPenalty, 0.94)
  const requiredGap = Math.max(0.12 - 0.05 * progress + wrongGuessPenalty, 0.08)
  const requiredEntropy = Math.max(0.55 - 0.2 * progress - priorWrongGuesses * 0.04, 0.3)

  const resultBase = {
    forced: false,
    topProbability,
    secondProbability,
    gap,
    entropy: currentEntropy,
    aliveCount,
    questionsRemaining,
    requiredConfidence,
    requiredGap,
    requiredEntropy,
  }

  // Ask a minimum of questions before non-forced guesses; only overwhelming certainty overrides.
  if (questionCount < 5 && topProbability < 0.95) {
    return {
      shouldGuess: false,
      trigger: 'insufficient_data',
      blockedByRejectCooldown: false,
      rejectCooldownRemaining: 0,
      ...resultBase,
    }
  }

  // Keep asking while budget remains and posterior is still broad.
  if (questionsRemaining > 3 && topProbability < 0.82 && aliveCount > 2) {
    return {
      shouldGuess: false,
      trigger: 'insufficient_data',
      blockedByRejectCooldown: false,
      rejectCooldownRemaining: 0,
      ...resultBase,
    }
  }

  const highCertainty = topProbability >= 0.93 && gap >= 0.25 && competitiveCount <= 2
  if (highCertainty) {
    return {
      shouldGuess: true,
      trigger: 'high_certainty',
      blockedByRejectCooldown: false,
      rejectCooldownRemaining: 0,
      ...resultBase,
    }
  }

  // questionCount >= 3 is always satisfied here (min-guard above blocks q < 5)
  const strictReady =
    topProbability >= requiredConfidence &&
    gap >= requiredGap &&
    competitiveCount <= 3 &&
    currentEntropy <= requiredEntropy

  return {
    shouldGuess: strictReady,
    trigger: strictReady ? 'strict_readiness' : 'insufficient_data',
    blockedByRejectCooldown: false,
    rejectCooldownRemaining: 0,
    ...resultBase,
  }
}

/** Get the best guess character, excluding previously rejected guesses. */
export function getBestGuess(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = [],
  scoring?: ScoringOptions
): ServerCharacter | null {
  if (characters.length === 0) return null

  const rejectedSet = new Set(rejectedGuesses)
  const eligible = characters.filter((c) => !rejectedSet.has(c.id))
  if (eligible.length === 0) return null

  const probabilities = calculateProbabilities(eligible, answers, scoring)
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
  // Use the same hard-filter as filterPossibleCharacters for consistency
  const remaining = filterPossibleCharacters(characters, answers).length
  return { hasContradiction: remaining === 0, remainingCount: remaining }
}

/** Hard-filter characters based on definitive answers and rejected guesses.
 *  Allows up to MAX_MISMATCHES contradictions to tolerate bad attribute data
 *  or occasional user errors. Characters beyond this threshold are eliminated. */
const MAX_MISMATCHES = 1

export function filterPossibleCharacters(
  characters: ServerCharacter[],
  answers: Answer[],
  rejectedGuesses: string[] = []
): ServerCharacter[] {
  const rejectedSet = new Set(rejectedGuesses)
  return characters.filter((char) => {
    if (rejectedSet.has(char.id)) return false
    let mismatches = 0
    for (const answer of answers) {
      const attr = char.attributes[answer.questionId]
      if (answer.value === 'yes' && attr === false) mismatches++
      else if (answer.value === 'no' && attr === true) mismatches++
      if (mismatches > MAX_MISMATCHES) return false
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
  postRejectCooldown?: number
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
    postRejectCooldown: session.postRejectCooldown,
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
    return {
      ...legacy,
      rejectedGuesses: legacy.rejectedGuesses ?? [],
      guessCount: legacy.guessCount ?? 0,
      postRejectCooldown: legacy.postRejectCooldown ?? 0,
    }
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
    postRejectCooldown: data.postRejectCooldown ?? 0,
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
    postRejectCooldown: session.postRejectCooldown,
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
