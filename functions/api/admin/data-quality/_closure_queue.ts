import { buildNullClosureQueue, type NullClosurePairInput } from '../../_null_closure'

const DQ_CATEGORIES = [
  'video-games',
  'movies',
  'anime',
  'comics',
  'books',
  'cartoons',
  'tv-shows',
  'pop-culture',
] as const

const DQ33_RULES = [
  {
    attributeKey: 'isHuman',
    targets: {
      'video-games': 1,
      movies: 1,
      anime: 1,
      comics: 1,
      books: 1,
      cartoons: 1,
      'tv-shows': 1,
      'pop-culture': 1,
    },
  },
  {
    attributeKey: 'firstAppearedYear',
    targets: {
      'video-games': 0.95,
      movies: 0.95,
      anime: 0.95,
      comics: 0.95,
      books: 0.95,
      cartoons: 0.95,
      'tv-shows': 0.95,
      'pop-culture': 0.9,
    },
  },
  {
    attributeKey: 'personality',
    targets: {
      'video-games': 0.7,
      movies: 0.7,
      anime: 0.75,
      comics: 0.7,
      books: 0.7,
      cartoons: 0.65,
      'tv-shows': 0.7,
      'pop-culture': 0.6,
    },
  },
] as const

export const DQ33_LANE_POLICY = {
  automationScoreThreshold: 0.00002,
  automationMinConfidenceGap: 0.1,
} as const

export const CLOSURE_QUEUE_REPORT_KEY = 'admin:data-quality:closure-queue:last'

interface CharacterRow {
  id: string
  name: string
  category: string
  popularity: number
  created_at: number
}

interface StoredRow {
  character_id: string
  attribute_key: string
}

interface QuestionRow {
  attribute_key: string
  question_count: number
}

interface AttemptRow {
  attribute_key: string
  attempt_count: number
  avg_info_gain: number | null
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function sqlQuote(s: string): string {
  return `'${s.replaceAll("'", "''")}'`
}

function buildSelectorImpactByAttr(
  rows: readonly AttemptRow[],
  questionCountByAttr: ReadonlyMap<string, number>
): Map<string, number> {
  const maxAttemptCount = Math.max(...rows.map((row) => Math.max(0, Math.trunc(num(row.attempt_count)))), 1)
  const maxInfoGain = Math.max(...rows.map((row) => Math.max(0, num(row.avg_info_gain))), 0.0001)
  const maxQuestionCount = Math.max(...questionCountByAttr.values(), 1)

  const byAttr = new Map<string, number>()
  for (const row of rows) {
    const attemptNorm = clamp01(num(row.attempt_count) / maxAttemptCount)
    const gainNorm = clamp01(num(row.avg_info_gain) / maxInfoGain)
    byAttr.set(row.attribute_key, Math.round((0.7 * attemptNorm + 0.3 * gainNorm) * 10000) / 10000)
  }

  for (const [attributeKey, questionCount] of questionCountByAttr.entries()) {
    if (byAttr.has(attributeKey)) continue
    const questionNorm = clamp01(questionCount / maxQuestionCount)
    byAttr.set(attributeKey, Math.round((0.15 + 0.85 * questionNorm) * 10000) / 10000)
  }

  return byAttr
}

export interface ClosureQueueReport {
  generatedAt: string
  limit: number
  lanePolicy: {
    automationScoreThreshold: number
    automationMinConfidenceGap: number
  }
  totalCandidatePairs: number
  summary: {
    totalPairs: number
    automationPairs: number
    manualPairs: number
    categories: Record<string, number>
    attributes: Record<string, number>
  }
  queue: ReturnType<typeof buildNullClosureQueue>
}

export async function buildClosureQueueReport(db: D1Database, limit: number): Promise<ClosureQueueReport> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

  const categoriesSql = DQ_CATEGORIES.map(sqlQuote).join(', ')
  const ruleKeys = DQ33_RULES.map((rule) => rule.attributeKey)
  const keysSql = ruleKeys.map(sqlQuote).join(', ')

  const [charactersRows, storedRows, questionRows, attemptsRows] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, category, popularity, created_at
           FROM characters
          WHERE category IN (${categoriesSql})`
      )
      .all<CharacterRow>(),
    db
      .prepare(
        `SELECT character_id, attribute_key
           FROM character_attributes
          WHERE value IS NOT NULL
            AND attribute_key IN (${keysSql})`
      )
      .all<StoredRow>(),
    db
      .prepare(
        `SELECT attribute_key, COUNT(*) AS question_count
           FROM questions
          WHERE retired_at IS NULL
            AND attribute_key IN (${keysSql})
          GROUP BY attribute_key`
      )
      .all<QuestionRow>(),
    db
      .prepare(
        `SELECT COALESCE(NULLIF(qa.attribute, ''), q.attribute_key) AS attribute_key,
                COUNT(*) AS attempt_count,
                AVG(CASE WHEN qa.probability_delta IS NOT NULL THEN qa.probability_delta ELSE 0 END) AS avg_info_gain
           FROM question_attempts qa
           LEFT JOIN questions q ON q.id = qa.question_id
          WHERE qa.created_at > unixepoch('now', '-90 days')
            AND COALESCE(NULLIF(qa.attribute, ''), q.attribute_key) IN (${keysSql})
          GROUP BY COALESCE(NULLIF(qa.attribute, ''), q.attribute_key)`
      )
      .all<AttemptRow>(),
  ])

  const characters = charactersRows.results ?? []
  const stored = storedRows.results ?? []
  const questions = questionRows.results ?? []
  const attempts = attemptsRows.results ?? []

  const charsByCategory = new Map<string, CharacterRow[]>()
  let maxPopularity = 0
  for (const character of characters) {
    maxPopularity = Math.max(maxPopularity, num(character.popularity))
    const arr = charsByCategory.get(character.category)
    if (arr) arr.push(character)
    else charsByCategory.set(character.category, [character])
  }

  const storedByCharacter = new Map<string, Set<string>>()
  for (const row of stored) {
    const set = storedByCharacter.get(row.character_id)
    if (set) set.add(row.attribute_key)
    else storedByCharacter.set(row.character_id, new Set([row.attribute_key]))
  }

  const questionCountByAttr = new Map<string, number>()
  for (const row of questions) {
    questionCountByAttr.set(row.attribute_key, Math.max(0, Math.trunc(num(row.question_count))))
  }

  const selectorImpactByAttr = buildSelectorImpactByAttr(attempts, questionCountByAttr)
  const nowSecs = Math.floor(Date.now() / 1000)

  const pairs: NullClosurePairInput[] = []
  for (const rule of DQ33_RULES) {
    for (const category of DQ_CATEGORIES) {
      const target = clamp01(num(rule.targets[category]))
      if (target <= 0) continue

      const categoryChars = charsByCategory.get(category) ?? []
      if (categoryChars.length === 0) continue

      let filledCount = 0
      for (const character of categoryChars) {
        if (storedByCharacter.get(character.id)?.has(rule.attributeKey)) filledCount += 1
      }

      const confidenceGap = Math.round(Math.max(0, target - filledCount / categoryChars.length) * 10000) / 10000
      if (confidenceGap <= 0) continue

      const selectorImpact = selectorImpactByAttr.get(rule.attributeKey) ?? 0.05
      const hasQuestion = (questionCountByAttr.get(rule.attributeKey) ?? 0) > 0

      for (const character of categoryChars) {
        if (storedByCharacter.get(character.id)?.has(rule.attributeKey)) continue
        pairs.push({
          characterId: character.id,
          characterName: character.name,
          category,
          attributeKey: rule.attributeKey,
          popularity: maxPopularity > 0 ? num(character.popularity) / maxPopularity : 0,
          selectorImpact,
          confidenceGap,
          stalenessDays: Math.max(0, (nowSecs - Math.trunc(num(character.created_at))) / 86400),
          hasQuestion,
        })
      }
    }
  }

  const queue = buildNullClosureQueue(pairs, {
    limit: safeLimit,
    automationScoreThreshold: DQ33_LANE_POLICY.automationScoreThreshold,
    automationMinConfidenceGap: DQ33_LANE_POLICY.automationMinConfidenceGap,
  })

  const summary = {
    totalPairs: queue.length,
    automationPairs: queue.filter((item) => item.lane === 'automation').length,
    manualPairs: queue.filter((item) => item.lane === 'manual').length,
    categories: queue.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1
      return acc
    }, {}),
    attributes: queue.reduce<Record<string, number>>((acc, item) => {
      acc[item.attributeKey] = (acc[item.attributeKey] ?? 0) + 1
      return acc
    }, {}),
  }

  return {
    generatedAt: new Date().toISOString(),
    limit: safeLimit,
    lanePolicy: DQ33_LANE_POLICY,
    totalCandidatePairs: pairs.length,
    summary,
    queue,
  }
}