#!/usr/bin/env npx tsx
/**
 * Audit attribute coverage: identify gaps, underserved attributes, and generate recommendations.
 *
 * Analyzes:
 *   1. All attributes in catalog (from character_attributes table)
 *   2. Existing questions (count per attribute)
 *   3. Question quality metrics (info gain, skip rate, maybe rate from question_attempts)
 *   4. Popularity of attributes (how many characters have each attribute)
 *   5. Filters out visual attributes (pending DQ.2 vision validation)
 *
 * Output: `data/audit-coverage-YYYY-MM-DD.json` with scoring + recommendations
 *
 * Usage:
 *   npx tsx scripts/audit-attribute-coverage.ts [--env production|preview] [--remote]
 *   npx tsx scripts/audit-attribute-coverage.ts --env production --remote
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const IS_REMOTE = process.argv.includes('--remote')
const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()

const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

// Visual attributes to deprioritize (await DQ.2 vision validation)
const VISUAL_ATTRIBUTES = new Set([
  'hasGlasses',
  'hasBeard',
  'hasMustache',
  'hasRedHair',
  'hasBlondeHair',
  'hasBlueEyes',
  'hasGreenEyes',
  'hasFacialHair',
  'hasLongHair',
  'hasShortHair',
  'isBald',
  'hasMask',
  'hasHat',
  'wearsGlasses',
  'isWearingHat',
  'dominantOutfitColor',
  'eyeColor',
  'hairColor',
  'hasFreckles',
  'hasScar',
  'hasTattoos',
  'hasWings',
  'hasClaws',
  'hasTail',
  'hasTentacles',
])

interface AttributeRow {
  key: string
  characterCount: number
  distribution: number
  questionsCount: number
  avgInfoGain: number | null
  skipRate: number | null
  maybeRate: number | null
  answerBalance: number | null // how balanced yes/no answers are (0=skewed, 1=50/50)
  isVisual: boolean
  needScore: number
}

interface AuditResult {
  timestamp: string
  stats: {
    totalAttributes: number
    attributesWithQuestions: number
    attributesWithoutQuestions: number
    visualAttributesCount: number
    nonVisualAttributesCount: number
  }
  topGaps: AttributeRow[]
  topUnderserved: AttributeRow[]
  topQualityIssues: AttributeRow[]
  recommendations: string[]
}

interface PopularityRow {
  attribute_key: string
  char_count: number
  total_rows: number
  true_count: number | null
}

interface QuestionCountRow {
  attribute: string
  question_count: number
}

interface QualityRow {
  attribute: string
  attempt_count: number
  avg_info_gain: number
  unknown_rate: number
  maybe_rate: number
  yes_rate: number
  no_rate: number
  answer_imbalance: number
}

interface TotalCharsRow {
  count: number
}

interface Attribute {
  key: string
  characterCount: number
  distribution: number
  questionsCount: number
  avgInfoGain: number | null
  skipRate: number | null
  maybeRate: number | null
  answerBalance: number | null // how balanced yes/no answers are (0=skewed, 1=50/50)
  isVisual: boolean
  needScore: number
}

function d1Query(sql: string): Array<Record<string, unknown>> {
  try {
    const out = execFileSync(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        DB_NAME,
        '--env',
        ENV_FLAG,
        IS_REMOTE ? '--remote' : '--local',
        '--json',
        '--command',
        sql,
      ],
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    )
    return JSON.parse(out).results || []
  } catch (e) {
    console.error(`D1 query failed: ${e}`)
    process.exit(1)
  }
}

function main() {
  console.log(`[audit-coverage] Starting attribute coverage audit...`)
  console.log(`  Environment: ${ENV_FLAG}`)
  console.log(`  Mode: ${IS_REMOTE ? 'remote' : 'local'}`)
  console.log()

  // ── Step 1: Get all attributes and their popularity ────────────────────────

  console.log('[1/5] Querying attribute popularity...')
  const attrPopularityRows = d1Query(`
    SELECT
      ca.attribute_key,
      COUNT(DISTINCT ca.character_id) as char_count,
      COUNT(*) as total_rows,
      SUM(CASE WHEN ca.value = 1 THEN 1 ELSE 0 END) as true_count
    FROM character_attributes ca
    WHERE ca.value IS NOT NULL
    GROUP BY ca.attribute_key
    ORDER BY char_count DESC
  `) as PopularityRow[]

  const totalCharsResult = d1Query(`SELECT COUNT(*) as count FROM characters`)[0] as TotalCharsRow | undefined
  const totalChars = totalCharsResult?.count ?? 0

  // ── Step 2: Get question counts per attribute ────────────────────────────

  console.log('[2/5] Querying question coverage...')
  const questionCountRows = d1Query(`
    SELECT attribute, COUNT(*) as question_count
    FROM questions
    WHERE deleted_at IS NULL
    GROUP BY attribute
  `) as QuestionCountRow[]
  const questionCountByAttr = new Map(
    questionCountRows.map((r) => [r.attribute, r.question_count])
  )

  // ── Step 3: Get question quality metrics ───────────────────────────────────

  console.log('[3/5] Computing question quality metrics...')
  const qualityRows = d1Query(`
    SELECT
      qa.attribute,
      COUNT(*) as attempt_count,
      AVG(CASE WHEN qa.probability_delta IS NOT NULL THEN qa.probability_delta ELSE 0 END) as avg_info_gain,
      SUM(CASE WHEN qa.answer = 'unknown' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as unknown_rate,
      SUM(CASE WHEN qa.answer = 'maybe' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as maybe_rate,
      SUM(CASE WHEN qa.answer = 'yes' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as yes_rate,
      SUM(CASE WHEN qa.answer = 'no' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as no_rate,
      ABS(
        SUM(CASE WHEN qa.answer = 'yes' THEN 1 ELSE 0 END) -
        SUM(CASE WHEN qa.answer = 'no' THEN 1 ELSE 0 END)
      ) * 100.0 / COUNT(*) as answer_imbalance
    FROM question_attempts qa
    WHERE qa.created_at > unixepoch('now', '-90 days')
    GROUP BY qa.attribute
  `) as QualityRow[]
  const qualityByAttr = new Map(
    qualityRows.map((r) => [
      r.attribute,
      {
        attemptCount: r.attempt_count,
        avgInfoGain: r.avg_info_gain,
        unknownRate: r.unknown_rate,
        maybeRate: r.maybe_rate,
        answerImbalance: r.answer_imbalance,
      },
    ])
  )

  // ── Step 4: Build attribute scoring ────────────────────────────────────────

  console.log('[4/5] Computing need scores...')

  const attributes: Attribute[] = attrPopularityRows.map((row) => {
    const key = row.attribute_key
    const charCount = row.char_count
    const trueCount = row.true_count ?? 0
    const distribution = charCount > 0 ? Math.min(trueCount, charCount - trueCount) / charCount : 0

    const qCount = questionCountByAttr.get(key) ?? 0
    const quality = qualityByAttr.get(key)

    const avgInfoGain = quality?.avgInfoGain ?? null
    const maybeRate = quality?.maybeRate ?? null
    const unknownRate = quality?.unknownRate ?? null
    const answerBalance = quality
      ? 1 - Math.min(quality.answerImbalance / 100, 1) // 1 = balanced, 0 = skewed
      : null

    // Need score = popularity × (1 − question_count) × quality_penalty
    // visual attrs get deprioritized
    const baseNeedScore =
      (charCount / (totalChars || 1)) * // popularity
      Math.max(1 - qCount / 3, 0) * // question coverage (median ~3 Qs per attribute)
      (avgInfoGain && avgInfoGain > 0 ? 1 : 0.5) // quality penalty: low info gain → lower score

    const isVisual = VISUAL_ATTRIBUTES.has(key)
    const needScore = isVisual ? baseNeedScore * 0.3 : baseNeedScore // visual deprioritized 70%

    return {
      key,
      characterCount: charCount,
      distribution,
      questionsCount: qCount,
      avgInfoGain,
      skipRate: unknownRate ? unknownRate + (maybeRate ?? 0) : null,
      maybeRate: maybeRate,
      answerBalance,
      isVisual,
      needScore,
    }
  })

  // Sort by need score
  attributes.sort((a, b) => b.needScore - a.needScore)

  // ── Step 5: Generate audit report ──────────────────────────────────────────

  console.log('[5/5] Generating report...')

  const topGaps = attributes.filter((a) => a.questionsCount === 0).slice(0, 20)
  const topUnderserved = attributes.filter((a) => !a.isVisual && a.questionsCount > 0 && a.questionsCount < 2).slice(0, 20)
  const topQualityIssues = attributes
    .filter(
      (a) =>
        a.avgInfoGain !== null &&
        a.avgInfoGain < 0.05 &&
        a.questionsCount > 0 &&
        a.skipRate &&
        a.skipRate > 40
    )
    .slice(0, 20)

  const recommendations: string[] = []

  if (topGaps.length > 0) {
    recommendations.push(`📊 ${topGaps.length} attributes have zero questions. Prioritize: ${topGaps.slice(0, 5).map((a) => a.key).join(', ')}`)
  }

  if (topUnderserved.length > 0) {
    recommendations.push(`📉 ${topUnderserved.length} attributes have 1 question. Consider adding variants to: ${topUnderserved.slice(0, 5).map((a) => a.key).join(', ')}`)
  }

  if (topQualityIssues.length > 0) {
    recommendations.push(`⚠️  ${topQualityIssues.length} questions underperforming (low info gain, high skip rate). Review: ${topQualityIssues.slice(0, 5).map((a) => a.key).join(', ')}`)
  }

  recommendations.push(`🎨 ${VISUAL_ATTRIBUTES.size} visual attributes deprioritized; await DQ.2 vision validation (hasGlasses, eyeColor, etc.)`)

  const stats = {
    totalAttributes: attributes.length,
    attributesWithQuestions: attributes.filter((a) => a.questionsCount > 0).length,
    attributesWithoutQuestions: attributes.filter((a) => a.questionsCount === 0).length,
    visualAttributesCount: attributes.filter((a) => a.isVisual).length,
    nonVisualAttributesCount: attributes.filter((a) => !a.isVisual).length,
  }

  const result: AuditResult = {
    timestamp: new Date().toISOString(),
    stats,
    topGaps,
    topUnderserved,
    topQualityIssues,
    recommendations,
  }

  // ── Write output ───────────────────────────────────────────────────────────

  const dateStr = new Date().toISOString().split('T')[0]
  const outputFile = path.join('data', `audit-coverage-${dateStr}.json`)
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2))

  console.log()
  console.log(`✅ Audit complete. Report saved to: ${outputFile}`)
  console.log()
  console.log(`📊 Summary:`)
  console.log(`   Total attributes: ${stats.totalAttributes}`)
  console.log(`   With questions: ${stats.attributesWithQuestions}`)
  console.log(`   Without questions: ${stats.attributesWithoutQuestions}`)
  console.log(`   Visual (deprioritized): ${stats.visualAttributesCount}`)
  console.log()
  console.log(`🎯 Top gaps (no questions):`)
  topGaps.slice(0, 5).forEach((a) => {
    console.log(
      `   • ${a.key} (${a.characterCount} chars, ${(a.distribution * 100).toFixed(1)}% distribution)`
    )
  })
  console.log()
  console.log(`💡 Recommendations:`)
  recommendations.forEach((r) => console.log(`   ${r}`))
}

main()
