/**
 * Pure math + classifiers extracted from question-selection.ts (RF.v2.3).
 *
 * These functions are deliberately side-effect-free and depend only on their
 * arguments — they can be exhaustively property-tested via fast-check and
 * reused outside the orchestration shell.
 *
 * The orchestrator in `../question-selection.ts` re-exports `entropy` and
 * `getAttributeGroup` to preserve the existing public API surface.
 */
import {
  MAYBE_ANSWER_PROB,
  NET_GAIN_FLOOR,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
  SCORE_UNKNOWN,
} from '../constants.js'
import type {
  GameAnswer,
  GameCharacter,
  GameQuestion,
  QuestionSelectionOptions,
  StructuralWeights,
} from '../types.js'

/** Shannon entropy of a probability distribution. */
export function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, p) => {
    if (p <= 0) return sum
    return sum - p * Math.log2(p)
  }, 0)
}

/**
 * Compute pairwise weighted separation for the top candidates on a given attribute.
 * High separation → this attribute distinguishes the top candidates well.
 */
export function calculateTopCandidateSeparation(
  topChars: GameCharacter[],
  probs: Map<string, number>,
  attribute: string
): { separation: number; coverage: number } {
  if (topChars.length < 2) return { separation: 0, coverage: 0 }

  let weightedSeparation = 0
  let totalWeight = 0
  let knownTopCandidates = 0

  for (const char of topChars) {
    if (char.attributes[attribute] != null) knownTopCandidates += 1
  }

  for (let i = 0; i < topChars.length; i++) {
    for (let j = i + 1; j < topChars.length; j++) {
      const left = topChars[i]
      const right = topChars[j]
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
export function getAttributeGroup(attribute: string): string {
  // Ability: things the character can do (powers, technology use, vehicles)
  if (
    attribute.startsWith('can') ||
    attribute === 'climbsWalls' ||
    attribute === 'controlsWeather' ||
    attribute === 'shootsLasers' ||
    attribute === 'usesTechnology' ||
    attribute === 'usesVehicle'
  )
    return 'ability'
  if (attribute.startsWith('has')) return 'possession'
  // Appearance: wears* + physical traits (bald, blind, etc.)
  if (attribute.startsWith('wears')) return 'appearance'
  if (/^is(Bald|Blind|Deaf|Disabled|Invisible|Mute)$/.test(attribute)) return 'appearance'

  // ── Origin family: three non-overlapping sub-groups ──

  // Medium: what format/platform the character comes from.
  // Lowercase from* is always a media type (fromBook, fromMovie, fromVideoGame).
  if (attribute.startsWith('from')) return 'medium'
  // isFrom* media-format sub-types
  if (
    /^isFrom(TVShow|Anime|LiveAction|ComicBook|IndieSource|AnimatedSeries|Cartoon|Sitcom|Movie|Book|Documentary|GameShow|RealityShow|PopCulture)$/.test(
      attribute
    )
  )
    return 'medium'

  // Genre: what genre/theme the source material belongs to (ends with Genre, Novel, or Fiction)
  if (attribute.endsWith('Genre') || attribute.endsWith('Novel') || attribute.endsWith('Fiction'))
    return 'genre'

  // Geography: physical or fictional setting, world, location, or era
  if (attribute.startsWith('livesIn')) return 'geography'
  if (
    /^isFrom(Earth|Japan|City|SmallTown|Village|Countryside|Island|Forest|Jungle|Swamp|Desert|Mountains|Ocean|Castle|Underground|FantasyWorld|Dystopia|Utopia|Future|ModernEra|MedievalTimes|Space)$/.test(
      attribute
    )
  )
    return 'geography'

  // Narrative: meta questions about source material and production
  if (
    /^(isPartOfFranchise|isPartOfEnsembleCast|appearsInSequel|appearsInPrequel|isBasedOnRealPerson)$/.test(
      attribute
    )
  )
    return 'narrative'
  // Status: relationship, socioeconomic state, and family background
  if (
    /^(isSingle|isMarried|isRich|isPoor|isFromMiddleClass|isFromNobleFamily|isFromPoorFamily|isFromRoyalFamily|isFromWealthyFamily|isFromMilitary)$/.test(
      attribute
    )
  )
    return 'status'
  // Species: fundamental character type (biological/ontological)
  if (
    /^is(Alien|Animal|Cyborg|Demon|Dwarf|Elf|Ghost|Giant|God|Human|Immortal|Mythical|Orc|Robot|Supernatural|Vampire|Wizard|Zombie)$/.test(
      attribute
    )
  )
    return 'species'
  if (/^is(Female|Male|GenderFluid|NonBinary|Transgender|Teenager)$/.test(attribute))
    return 'identity'
  if (
    /^is(Antagonist|Assassin|Detective|Hero|Knight|Leader|Mentor|Ninja|Pirate|Protagonist|Royalty|Samurai|Sidekick|Villain|Scientist|Engineer|Traitor)$/.test(
      attribute
    )
  )
    return 'role'
  if (
    /^is(Adventurous|Brave|Charming|Clumsy|Cowardly|Creative|Cruel|Cunning|Curious|Devious|Energetic|Foolish|Funny|Greedy|Honest|Humorous|Impatient|Intelligent|Kind|Lazy|Loyal|Naive|Optimistic|Patient|Pessimistic|Rebellious|Sarcastic|Serious|Skeptical|Wise|Iconic)$/.test(
      attribute
    )
  )
    return 'personality'
  // Remaining isFrom*/livesIn* catch-all → geography
  if (attribute.startsWith('isFrom') || attribute.startsWith('livesIn')) return 'geography'
  return 'other'
}

/**
 * Per-question scoring context. Bundles the pre-computed state that the
 * orchestrator builds once per `selectBestQuestion` call so `scoreQuestion`
 * stays a pure function of (question, ctx) → score.
 */
export interface QuestionScoringContext {
  characters: GameCharacter[]
  answers: GameAnswer[]
  probs: Map<string, number>
  currentEntropy: number
  topNChars: GameCharacter[]
  topTwoChars: GameCharacter[]
  topNMass: number
  endgameFocus: boolean
  progress: number
  needsSpecies: boolean
  needsOrigin: boolean
  recentAttrGroups: Set<string>
  nullRatioMap: Map<string, number>
  options: QuestionSelectionOptions | undefined
  sw: StructuralWeights | undefined
}

/**
 * Score a single question under the given context.
 * Pure: same (question, ctx) → same { score, topTwoSplit }, no I/O.
 *
 * The scoring blend (in order applied):
 *   1. Three-way expected entropy (yes/no/maybe partitions)
 *   2. Sigmoid coverage penalty for sparse attributes
 *   3. Top-N differentiation boost (pre-endgame)
 *   4. Pairwise top-candidate separation boost (endgame)
 *   5. Category + attribute-group diversity penalties
 *   6. Early-game taxonomy boosts (species / origin)
 *   7. Confusion discriminator boosts (endgame)
 *   8. Difficulty soft-filter
 *   9. Empirical info-gain blend (theoretical 0.7 + empirical 0.3)
 *  10. C.6 quality penalty
 */
export function scoreQuestion(
  question: GameQuestion,
  ctx: QuestionScoringContext
): { score: number; topTwoSplit: boolean } {
  const {
    characters,
    probs,
    currentEntropy,
    topNChars,
    topTwoChars,
    topNMass,
    endgameFocus,
    progress,
    needsSpecies,
    needsOrigin,
    recentAttrGroups,
    nullRatioMap,
    options,
    sw,
  } = ctx

  let pYes = 0
  let pNo = 0
  const yesProbs: number[] = []
  const noProbs: number[] = []
  const unknownProbs: number[] = []
  let maybeSum = 0
  const maybeWeighted: number[] = []

  for (const c of characters) {
    const prob = probs.get(c.id) ?? 0
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

  // Three-way expected entropy: yes/no/maybe partitions.
  // Use per-attribute maybe rate when available — replaces global MAYBE_ANSWER_PROB
  // (e.g. 'isFunny' gets far more maybe answers than 'isHuman', skewing entropy estimates).
  const maybeProb = options?.maybeRateMap?.[question.attribute] ?? MAYBE_ANSWER_PROB
  let expectedEntropy = 0
  const pUnknown = unknownProbs.reduce((s, p) => s + p, 0)
  const yesTotal = pYes + pUnknown * 0.5
  const noTotal = pNo + pUnknown * 0.5

  // Adjusted weights to account for maybe answers
  const adjustedYes = yesTotal * (1 - maybeProb)
  const adjustedNo = noTotal * (1 - maybeProb)

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
    expectedEntropy += maybeProb * entropy(maybeGroupProbs)
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
    const { separation, coverage } = calculateTopCandidateSeparation(
      topNChars,
      probs,
      question.attribute
    )
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
      infoGain *= sw?.diversityCategoryPenalty ?? 0.8
    }
  }

  // Attribute group diversity: penalise consecutive same-type questions
  const attrGroup = getAttributeGroup(question.attribute)
  if (attrGroup !== 'other' && recentAttrGroups.has(attrGroup)) {
    infoGain *= sw?.diversityGroupPenalty ?? 0.75
  }

  // Early-game taxonomy boost: applied after all other adjustments so it can
  // override the diversity penalty.  Species gets a lift to ensure the AI
  // asks "is it human / animal / robot?" before narrowing into specifics.
  // Origin gets a lift to anchor the franchise early.
  if (needsSpecies && attrGroup === 'species') {
    infoGain *= sw?.taxonomySpeciesBoost ?? 2.0
  } else if (
    needsOrigin &&
    (attrGroup === 'medium' || attrGroup === 'geography' || attrGroup === 'genre')
  ) {
    infoGain *= sw?.taxonomyOriginBoost ?? 1.3
  }

  // Confusion discriminator boost: in endgame, strongly prefer questions that simulation
  // data shows best separate the top candidate from its most frequent confusers.
  if (endgameFocus && options?.confusionDiscriminators) {
    const topCharId = topNChars[0]?.id
    if (topCharId && options.confusionDiscriminators[topCharId]?.includes(question.attribute)) {
      infoGain *= 1.4
    }
  }

  // Real-game confusion-pair boost: when the top-2 candidates appear together in
  // the `character_confusions` table (populated from real losses) and a question
  // splits them on stored attributes, apply the same ×1.4 endgame discriminator.
  if (endgameFocus && options?.confusionPairs && topNChars.length >= 2) {
    const a = topNChars[0].id
    const b = topNChars[1].id
    const key = a < b ? `${a}::${b}` : `${b}::${a}`
    if (options.confusionPairs.has(key)) {
      const valueA = topNChars[0].attributes[question.attribute]
      const valueB = topNChars[1].attributes[question.attribute]
      if (valueA !== null && valueB !== null && valueA !== valueB) {
        infoGain *= 1.4
      }
    }
  }

  // Difficulty soft-filter: de-prioritize questions tagged for a different difficulty level.
  // Only applies when both the game difficulty and the question's difficulty tag are set.
  // A 0.5× penalty keeps mismatched questions available as a last resort.
  if (
    options?.gameDifficulty &&
    question.difficulty &&
    question.difficulty !== options.gameDifficulty
  ) {
    infoGain *= 0.5
  }

  // Empirical info-gain blend: when real-game observed gain is available for this
  // attribute, blend final score = 0.7 × theoretical + 0.3 × empirical. Conservative
  // weight so theoretical Bayesian gain stays primary; empirical refines tie-breaks.
  const empiricalGain = options?.questionEmpiricalGainMap?.[question.attribute]
  if (empiricalGain !== undefined) {
    infoGain = 0.7 * infoGain + 0.3 * empiricalGain
  }

  // C.6 quality penalty: down-weight questions trending toward AN.17 retirement
  // (high skip rate / maybe rate / answer imbalance) before an admin pulls them.
  // Map values live in `(0, 1]`; missing keys are treated as 1 (no penalty).
  const qualityMultiplier = options?.questionQualityPenaltyMap?.[question.attribute]
  if (qualityMultiplier !== undefined && qualityMultiplier > 0 && qualityMultiplier < 1) {
    infoGain *= qualityMultiplier
  }

  return { score: infoGain, topTwoSplit }
}

/**
 * Pre-filter the question pool against the net-gain floor.
 * Pure helper used by the orchestrator before per-question scoring.
 */
export function applyNetGainFloor(
  availableQuestions: GameQuestion[],
  netGainMap: Record<string, number> | undefined,
  netGainFloor: number | undefined
): GameQuestion[] {
  const ngFloor = netGainFloor ?? NET_GAIN_FLOOR
  if (!netGainMap) return availableQuestions
  if (!availableQuestions.some((q) => (netGainMap[q.attribute] ?? 1) >= ngFloor)) {
    return availableQuestions
  }
  return availableQuestions.filter((q) => (netGainMap[q.attribute] ?? 1) >= ngFloor)
}

/** Pre-compute the null ratio per attribute over the candidate pool. */
export function buildNullRatioMap(
  characters: GameCharacter[],
  questions: GameQuestion[]
): Map<string, number> {
  const map = new Map<string, number>()
  if (characters.length === 0) return map
  for (const q of questions) {
    let nullCount = 0
    for (const c of characters) {
      if (c.attributes[q.attribute] == null) nullCount++
    }
    map.set(q.attribute, nullCount / characters.length)
  }
  return map
}
