import { MAYBE_ANSWER_PROB, MIN_INFO_GAIN, NET_GAIN_FLOOR, SCORE_MAYBE, SCORE_MAYBE_MISS, SCORE_UNKNOWN } from './constants.js'
import { calculateProbabilities } from './scoring.js'
import type { GameAnswer, GameCharacter, GameQuestion, QuestionSelectionOptions } from './types.js'

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
function calculateTopCandidateSeparation(
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
 * Pick the question with the highest expected information gain.
 *
 * Algorithm features:
 * - Three-way expected entropy (yes/no/maybe answer partitions)
 * - Sigmoid coverage penalty for sparse attributes
 * - Top-N differentiation boost (pre-endgame)
 * - Pairwise top-candidate separation boost (endgame)
 * - Category and attribute-group diversity penalties
 * - Dynamic top-K weighted random selection for early-game variety
 */
export function selectBestQuestion(
  characters: GameCharacter[],
  answers: GameAnswer[],
  allQuestions: GameQuestion[],
  options?: QuestionSelectionOptions
): GameQuestion | null {
  const askedAttributes = new Set(answers.map((a) => a.questionId))
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute))

  if (availableQuestions.length === 0) return null

  // Use pre-computed probs if provided (avoids redundant calculateProbabilities call)
  const probs =
    options?.probs ?? calculateProbabilities(characters, answers, options?.scoring)

  const sortedProbs = Array.from(probs.entries())
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length))
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0)
  const topNChars = topN
    .map(([id]) => characters.find((c) => c.id === id))
    .filter((c): c is GameCharacter => c !== undefined)
  const topTwoChars = topNChars.slice(0, 2)

  const currentProbs = characters.map((c) => probs.get(c.id) ?? 0)
  const currentEntropy = entropy(currentProbs)
  const progress = options?.progress ?? 0
  const sw = options?.structuralWeights
  const endgameFocusThreshold = sw?.endgameFocusThreshold ?? 0.65
  const endgameFocus = progress >= endgameFocusThreshold || topNMass >= 0.75
  const diversityWindow = sw?.diversityWindow ?? 5
  const recentAttrGroups = new Set(answers.slice(-diversityWindow).map((a) => getAttributeGroup(a.questionId)))

  // Early-game taxonomy forcing: if no species/origin question has been asked yet and we
  // are still in the first 40% of the game, boost those attribute groups so the AI
  // establishes the fundamental character type (human / animal / robot / alien …) before
  // diving into specific ability or appearance questions.  Without this boost, very rare
  // types (e.g. robots, ~0.2% of the pool) produce near-zero info-gain and are never asked
  // directly — leaving null-attributed characters alive far too long.
  const earlyGame = progress < 0.4
  const needsSpecies =
    earlyGame && !answers.some((a) => getAttributeGroup(a.questionId) === 'species')
  const needsOrigin =
    earlyGame &&
    !answers.some((a) => {
      const g = getAttributeGroup(a.questionId)
      return g === 'medium' || g === 'geography' || g === 'genre'
    })

  // Net-gain pre-filter: skip provably low-info questions when higher-gain alternatives exist.
  // Uses sim-derived netGainMap (avgGain × (1 − unknownRate)) to exclude attributes that
  // consistently contribute little information regardless of pool state.
  const ngFloor = sw?.netGainFloor ?? NET_GAIN_FLOOR
  const ngMap = options?.netGainMap
  const questionsToScore =
    ngMap && availableQuestions.some((q) => (ngMap[q.attribute] ?? 1) >= ngFloor)
      ? availableQuestions.filter((q) => (ngMap[q.attribute] ?? 1) >= ngFloor)
      : availableQuestions

  // Pre-compute null ratios for coverage penalty (avoids O(Q×C) re-scan inside the loop)
  const nullRatioMap = new Map<string, number>()
  for (const q of questionsToScore) {
    let nullCount = 0
    for (const c of characters) {
      if (c.attributes[q.attribute] == null) nullCount++
    }
    nullRatioMap.set(q.attribute, nullCount / characters.length)
  }

  const scored: Array<{ question: GameQuestion; score: number; topTwoSplit: boolean }> = []

  for (const question of questionsToScore) {
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
    } else if (needsOrigin && (attrGroup === 'medium' || attrGroup === 'geography' || attrGroup === 'genre')) {
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

    scored.push({ question, score: infoGain, topTwoSplit })
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => b.score - a.score)
  if (scored[0].score <= 0) return scored[0].question

  if (endgameFocus && progress >= 0.85) {
    const bestTopTwoSplit = scored.find((candidate) => candidate.topTwoSplit)
    // Threshold scales down as turns run out: 0.55 at progress=0.85 → 0.40 at progress=1.0
    const splitThreshold = Math.max(0.55 - (progress - 0.85), 0.4)
    // Also require a minimum absolute information gain floor so the top-two split
    // boost can't select a near-zero-IG question over a genuinely informative one.
    const igFloor = Math.max(currentEntropy * 0.05, 0.02)
    if (bestTopTwoSplit && bestTopTwoSplit.score >= scored[0].score * splitThreshold && bestTopTwoSplit.score >= igFloor) {
      return bestTopTwoSplit.question
    }
    return scored[0].question
  }

  // Dynamic top-K threshold: more variety early, more optimal late.
  // When endgame focus is active, cap the pool to avoid wasting turns.
  const baseFactor = 0.3 + 0.6 * progress // 0.3 early → 0.9 late
  const thresholdFactor = endgameFocus ? Math.max(baseFactor, 0.8) : baseFactor
  const relativeThreshold = scored[0].score * thresholdFactor
  // Apply absolute floor so near-zero-gain questions (e.g. 100%-unknown attrs or
  // globally uninformative ones) are excluded from the selection pool when better
  // alternatives exist. Fall back to the full sorted list if all scores are sub-floor.
  const threshold = Math.max(relativeThreshold, MIN_INFO_GAIN)
  const topK = scored.filter((s) => s.score >= threshold)
  const pool = topK.length > 0 ? topK : scored.slice(0, 1)
  const totalWeight = pool.reduce((sum, s) => sum + s.score, 0)
  let random = Math.random() * totalWeight
  for (const candidate of pool) {
    random -= candidate.score
    if (random <= 0) return candidate.question
  }

  return pool[0].question
}
