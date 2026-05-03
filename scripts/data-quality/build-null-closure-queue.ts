#!/usr/bin/env npx tsx
/**
 * DQ.33 — build the deterministic null-closure queue.
 *
 * Reads the canonical SLA matrix, queries live D1 state, and ranks missing
 * (character, attribute) pairs by:
 *   popularity × selector_impact × confidence_gap × staleness
 *
 * The output is a stable JSON report intended to feed both the existing
 * sparse-fill automation lane and future manual completeness review surfaces.
 *
 * Usage:
 *   npx tsx scripts/data-quality/build-null-closure-queue.ts --env preview
 *   npx tsx scripts/data-quality/build-null-closure-queue.ts --env production --limit 250
 *   npx tsx scripts/data-quality/build-null-closure-queue.ts --env preview --json
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildNullClosureQueue,
  type NullClosurePairInput,
} from '../../functions/api/_null_closure'

interface SlaRule {
  attributeKey: string
  targets: Record<string, number>
}

interface SlaConfig {
  version: number
  updatedAt: string
  categories: string[]
  global: {
    warnScore: number
    failScore: number
    defaultCategoryFloor: number
    disputeBudget: number
  }
  rules: SlaRule[]
}

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

interface QueueSummary {
  totalPairs: number
  automationPairs: number
  manualPairs: number
  categories: Record<string, number>
  attributes: Record<string, number>
}

interface ClosureInputs {
  characters: CharacterRow[]
  stored: StoredRow[]
  questions: QuestionRow[]
  attempts: AttemptRow[]
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
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

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

const ENV_FLAG = flag('--env') ?? 'production'
const LIMIT = Math.max(1, Math.trunc(num(flag('--limit') ?? '200')))
const AUTOMATION_THRESHOLD = Math.max(0, num(flag('--automation-threshold') ?? '0.00002'))
const AUTOMATION_MIN_GAP = clamp01(num(flag('--automation-min-gap') ?? '0.1'))
const JSON_ONLY = process.argv.includes('--json')
const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SLA_PATH = path.join(REPO_ROOT, 'data', 'attribute-completeness-sla.json')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'null-closure')

function loadSlaConfig(): SlaConfig {
  const raw = readFileSync(SLA_PATH, 'utf8')
  return JSON.parse(raw) as SlaConfig
}

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  )
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>
  return parsed[0]?.results ?? []
}

function sqlQuote(s: string): string {
  return `'${s.replaceAll("'", "''")}'`
}

function summarize(queue: ReturnType<typeof buildNullClosureQueue>): QueueSummary {
  const categories: Record<string, number> = {}
  const attributes: Record<string, number> = {}
  let automationPairs = 0
  let manualPairs = 0

  for (const item of queue) {
    categories[item.category] = (categories[item.category] ?? 0) + 1
    attributes[item.attributeKey] = (attributes[item.attributeKey] ?? 0) + 1
    if (item.lane === 'automation') automationPairs += 1
    else manualPairs += 1
  }

  return {
    totalPairs: queue.length,
    automationPairs,
    manualPairs,
    categories,
    attributes,
  }
}

function loadClosureInputs(sla: SlaConfig): ClosureInputs {
  const ruleKeys = [...new Set(sla.rules.map((rule) => rule.attributeKey))]
  const categoriesSql = sla.categories.map(sqlQuote).join(', ')
  const keysSql = ruleKeys.map(sqlQuote).join(', ')

  const characters = d1<CharacterRow>(
    `SELECT id, name, category, popularity, created_at
       FROM characters
      WHERE category IN (${categoriesSql})`
  )

  const stored = d1<StoredRow>(
    `SELECT character_id, attribute_key
       FROM character_attributes
      WHERE value IS NOT NULL
        AND attribute_key IN (${keysSql})`
  )

  const questions = d1<QuestionRow>(
    `SELECT attribute_key, COUNT(*) AS question_count
       FROM questions
      WHERE retired_at IS NULL
        AND attribute_key IN (${keysSql})
      GROUP BY attribute_key`
  )

  const attempts = d1<AttemptRow>(
    `SELECT COALESCE(NULLIF(qa.attribute, ''), q.attribute_key) AS attribute_key,
            COUNT(*) AS attempt_count,
            AVG(CASE WHEN qa.probability_delta IS NOT NULL THEN qa.probability_delta ELSE 0 END) AS avg_info_gain
       FROM question_attempts qa
       LEFT JOIN questions q ON q.id = qa.question_id
      WHERE qa.created_at > unixepoch('now', '-90 days')
        AND COALESCE(NULLIF(qa.attribute, ''), q.attribute_key) IN (${keysSql})
      GROUP BY COALESCE(NULLIF(qa.attribute, ''), q.attribute_key)`
  )

  return { characters, stored, questions, attempts }
}

function buildCategoryMap(characters: readonly CharacterRow[]): {
  charsByCategory: Map<string, CharacterRow[]>
  maxPopularity: number
} {
  const charsByCategory = new Map<string, CharacterRow[]>()
  let maxPopularity = 0
  for (const character of characters) {
    maxPopularity = Math.max(maxPopularity, num(character.popularity))
    const list = charsByCategory.get(character.category)
    if (list) list.push(character)
    else charsByCategory.set(character.category, [character])
  }

  return { charsByCategory, maxPopularity }
}

function buildStoredByCharacter(rows: readonly StoredRow[]): Map<string, Set<string>> {
  const storedByCharacter = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = storedByCharacter.get(row.character_id)
    if (set) set.add(row.attribute_key)
    else storedByCharacter.set(row.character_id, new Set([row.attribute_key]))
  }

  return storedByCharacter
}

function buildQuestionCountByAttr(rows: readonly QuestionRow[]): Map<string, number> {
  const questionCountByAttr = new Map<string, number>()
  for (const row of rows) {
    questionCountByAttr.set(row.attribute_key, Math.max(0, Math.trunc(num(row.question_count))))
  }

  return questionCountByAttr
}

function buildSelectorImpactByAttr(
  rows: readonly AttemptRow[],
  questionCountByAttr: ReadonlyMap<string, number>
): Map<string, number> {
  const maxAttemptCount = Math.max(...rows.map((row) => Math.max(0, Math.trunc(num(row.attempt_count)))), 1)
  const maxInfoGain = Math.max(...rows.map((row) => Math.max(0, num(row.avg_info_gain))), 0.0001)
  const maxQuestionCount = Math.max(...questionCountByAttr.values(), 1)
  const selectorImpactByAttr = new Map<string, number>()

  for (const row of rows) {
    const attemptNorm = clamp01(num(row.attempt_count) / maxAttemptCount)
    const gainNorm = clamp01(num(row.avg_info_gain) / maxInfoGain)
    selectorImpactByAttr.set(row.attribute_key, Math.round((0.7 * attemptNorm + 0.3 * gainNorm) * 10000) / 10000)
  }

  // Preview environments can have zero question_attempts. Use live question
  // coverage as a deterministic fallback so selector impact still differentiates keys.
  for (const [attributeKey, questionCount] of questionCountByAttr.entries()) {
    if (selectorImpactByAttr.has(attributeKey)) continue
    const questionNorm = clamp01(questionCount / maxQuestionCount)
    selectorImpactByAttr.set(attributeKey, Math.round((0.15 + 0.85 * questionNorm) * 10000) / 10000)
  }

  return selectorImpactByAttr
}

function countFilled(categoryChars: readonly CharacterRow[], attributeKey: string, storedByCharacter: ReadonlyMap<string, ReadonlySet<string>>): number {
  let filledCount = 0
  for (const character of categoryChars) {
    if (storedByCharacter.get(character.id)?.has(attributeKey)) filledCount += 1
  }
  return filledCount
}

function buildRuleCategoryPairs(args: {
  rule: SlaRule
  category: string
  categoryChars: readonly CharacterRow[]
  storedByCharacter: ReadonlyMap<string, ReadonlySet<string>>
  selectorImpact: number
  hasQuestion: boolean
  maxPopularity: number
  nowSecs: number
}): NullClosurePairInput[] {
  const {
    rule,
    category,
    categoryChars,
    storedByCharacter,
    selectorImpact,
    hasQuestion,
    maxPopularity,
    nowSecs,
  } = args

  return categoryChars
    .filter((character) => !storedByCharacter.get(character.id)?.has(rule.attributeKey))
    .map((character) => ({
      characterId: character.id,
      characterName: character.name,
      category,
      attributeKey: rule.attributeKey,
      popularity: maxPopularity > 0 ? num(character.popularity) / maxPopularity : 0,
      selectorImpact,
      confidenceGap: 0,
      stalenessDays: Math.max(0, (nowSecs - Math.trunc(num(character.created_at))) / 86400),
      hasQuestion,
    }))
}

function buildPairs(
  sla: SlaConfig,
  characters: readonly CharacterRow[],
  stored: readonly StoredRow[],
  questions: readonly QuestionRow[],
  attempts: readonly AttemptRow[]
): NullClosurePairInput[] {
  const nowSecs = Math.floor(Date.now() / 1000)
  const { charsByCategory, maxPopularity } = buildCategoryMap(characters)
  const storedByCharacter = buildStoredByCharacter(stored)
  const questionCountByAttr = buildQuestionCountByAttr(questions)
  const selectorImpactByAttr = buildSelectorImpactByAttr(attempts, questionCountByAttr)
  const pairs: NullClosurePairInput[] = []

  for (const rule of sla.rules) {
    for (const category of sla.categories) {
      const target = clamp01(num(rule.targets[category]))
      if (target <= 0) continue

      const categoryChars = charsByCategory.get(category) ?? []
      if (categoryChars.length === 0) continue

      const filledCount = countFilled(categoryChars, rule.attributeKey, storedByCharacter)
      const currentCompleteness = filledCount / categoryChars.length
      const confidenceGap = Math.round(Math.max(0, target - currentCompleteness) * 10000) / 10000
      if (confidenceGap <= 0) continue

      const selectorImpact = selectorImpactByAttr.get(rule.attributeKey) ?? 0.05
      const hasQuestion = (questionCountByAttr.get(rule.attributeKey) ?? 0) > 0

      const categoryPairs = buildRuleCategoryPairs({
        rule,
        category,
        categoryChars,
        storedByCharacter,
        selectorImpact,
        hasQuestion,
        maxPopularity,
        nowSecs,
      }).map((pair) => ({
        ...pair,
        confidenceGap,
      }))

      pairs.push(...categoryPairs)
    }
  }

  return pairs
}

function printReport(
  sla: SlaConfig,
  pairs: readonly NullClosurePairInput[],
  summary: QueueSummary,
  queue: ReturnType<typeof buildNullClosureQueue>,
  outPath: string
): void {
  console.log('DQ null-closure queue')
  console.log('---------------------')
  console.log(`env                     : ${ENV_FLAG}`)
  console.log(`sla version             : ${sla.version}`)
  console.log(`candidate pairs         : ${pairs.length.toLocaleString()}`)
  console.log(`queued pairs            : ${summary.totalPairs.toLocaleString()}`)
  console.log(`automation lane         : ${summary.automationPairs.toLocaleString()}`)
  console.log(`manual lane             : ${summary.manualPairs.toLocaleString()}`)
  console.log(`report path             : ${outPath}`)

  const top = queue.slice(0, 10)
  if (top.length === 0) {
    console.log('top queue               : none')
    return
  }

  console.log('top queue')
  for (const item of top) {
    console.log(
      `  - ${item.characterName} :: ${item.attributeKey} [${item.category}] ${item.lane} score=${item.score.toFixed(6)} gap=${pct(item.components.confidenceGap)}`
    )
  }
}

function main(): void {
  const sla = loadSlaConfig()
  const { characters, stored, questions, attempts } = loadClosureInputs(sla)
  const pairs = buildPairs(sla, characters, stored, questions, attempts)

  const queueWithLanePolicy = buildNullClosureQueue(pairs, {
    limit: LIMIT,
    automationScoreThreshold: AUTOMATION_THRESHOLD,
    automationMinConfidenceGap: AUTOMATION_MIN_GAP,
  })
  const summary = summarize(queueWithLanePolicy)
  const generatedAt = new Date().toISOString()

  const report = {
    generatedAt,
    env: ENV_FLAG,
    limit: LIMIT,
    lanePolicy: {
      automationScoreThreshold: AUTOMATION_THRESHOLD,
      automationMinConfidenceGap: AUTOMATION_MIN_GAP,
    },
    slaVersion: sla.version,
    totalCandidatePairs: pairs.length,
    summary,
    queue: queueWithLanePolicy,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `null-closure-${ENV_FLAG}-${generatedAt.slice(0, 10)}.json`)
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  if (JSON_ONLY) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  printReport(sla, pairs, summary, queueWithLanePolicy, outPath)
}

main()