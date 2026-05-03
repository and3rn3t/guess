#!/usr/bin/env npx tsx
/**
 * Phase 2: Generate questions for attribute gaps identified by audit-attribute-coverage.ts
 *
 * This script:
 *   1. Loads the most recent audit-coverage JSON report
 *   2. Selects top N underserved attributes
 *   3. Calls the question generator with metadata synthesis
 *   4. Validates questions with embeddings (deduplication)
 *   5. Upserts to D1 questions table
 *   6. Outputs summary of generated questions
 *
 * Usage:
 *   npx tsx scripts/generate-gap-questions.ts --audit data/audit-coverage-2026-05-02.json --limit 20
 *   npx tsx scripts/generate-gap-questions.ts --remote --dry-run
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface AuditGap {
  key: string
  characterCount: number
  questionsCount: number
  needScore: number
}

interface AuditResult {
  timestamp: string
  stats: { totalAttributes: number; attributesWithoutQuestions: number }
  topGaps: AuditGap[]
  topUnderserved: AuditGap[]
}

interface LegacyAuditRow {
  key: string
  hasQuestion?: boolean
  coveragePct?: number
  score?: number
  flags?: string[]
}

interface AttributeDefinitionRow {
  key: string
  display_text: string | null
  question_text: string | null
}

interface ExistingQuestionRow {
  id: string
  attribute_key: string
  text: string
}

interface CoverageRow {
  key: string
  display_text: string | null
  question_text: string | null
  character_count: number
  question_count: number
}

interface CandidateQuestion {
  id: string
  attributeKey: string
  text: string
  source: 'displayText' | 'questionText' | 'variant'
}

const DRY_RUN = process.argv.includes('--dry-run')
const REMOTE = process.argv.includes('--remote')
const ENV_FLAG = (() => {
  const i = process.argv.indexOf('--env')
  return i >= 0 ? process.argv[i + 1] : 'production'
})()

const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 20 : 20
})()

const AUDIT_PATH = (() => {
  const i = process.argv.indexOf('--audit')
  return i >= 0 ? process.argv[i + 1] : null
})()

const APPLY = process.argv.includes('--apply')

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function shortHash(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeQuestionText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed
  const withQuestion = trimmed.endsWith('?') ? trimmed : `${trimmed}?`
  return `${withQuestion.charAt(0).toUpperCase()}${withQuestion.slice(1)}`
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
        REMOTE ? '--remote' : '--local',
        '--json',
        '--command',
        sql,
      ],
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    )
    const parsed = JSON.parse(out) as
      | { results?: Array<Record<string, unknown>> }
      | Array<{ results?: Array<Record<string, unknown>> }>

    if (Array.isArray(parsed)) {
      return parsed[0]?.results ?? []
    }
    return parsed.results ?? []
  } catch (err) {
    console.error(`D1 query failed: ${err}`)
    process.exit(1)
  }
}

function renderQuestionFromDisplay(displayText: string): string {
  const d = displayText.trim()
  const lower = d.toLowerCase()

  if (lower.startsWith('is ')) return normalizeQuestionText(`Is this character ${d.slice(3).trim()}`)
  if (lower.startsWith('can ')) return normalizeQuestionText(`Can this character ${d.slice(4).trim()}`)
  if (lower.startsWith('does ')) return normalizeQuestionText(d)
  if (lower.startsWith('has ')) return normalizeQuestionText(`Does this character have ${d.slice(4).trim()}`)
  if (lower.startsWith('wears ')) return normalizeQuestionText(`Does this character wear ${d.slice(6).trim()}`)
  if (lower.startsWith('from ')) return normalizeQuestionText(`Is this character from ${d.slice(5).trim()}`)

  return normalizeQuestionText(`Does this character have the trait: ${d}`)
}

function buildVariants(baseQuestion: string): string[] {
  const q = normalizeQuestionText(baseQuestion)
  const lower = q.toLowerCase()

  if (lower.startsWith('is this character ')) {
    return [q, normalizeQuestionText(q.replace(/^is this character /i, 'would this character be considered '))]
  }

  if (lower.startsWith('does this character ')) {
    return [q, normalizeQuestionText(q.replace(/^does this character /i, 'is this character known to '))]
  }

  if (lower.startsWith('can this character ')) {
    return [q, normalizeQuestionText(q.replace(/^can this character /i, 'is this character able to '))]
  }

  return [q]
}

function makeQuestionId(attributeKey: string, text: string): string {
  return `qg_${attributeKey}_${shortHash(text)}`
}

function pickTargetsFromCoverage(rows: CoverageRow[], limit: number): string[] {
  const gaps = rows
    .filter((r) => r.question_count === 0)
    .sort((a, b) => b.character_count - a.character_count)
    .slice(0, Math.floor(limit / 2))

  const underserved = rows
    .filter((r) => r.question_count > 0 && r.question_count < 2)
    .sort((a, b) => b.character_count - a.character_count)
    .slice(0, Math.ceil(limit / 2))

  return Array.from(new Set([...gaps, ...underserved].map((r) => r.key)))
}

// Find the most recent audit-coverage JSON
function findLatestAudit(): string | null {
  const dir = 'data'
  if (!fs.existsSync(dir)) return null

  const files = fs.readdirSync(dir).filter((f) => f.startsWith('audit-coverage-') && f.endsWith('.json'))

  if (files.length === 0) return null

  files.sort().reverse()
  return path.join(dir, files[0])
}

function main() {
  console.log(`[generate-gap-questions] Phase 2: Gap-filling question generation`)
  console.log(`  Environment: ${ENV_FLAG}`)
  console.log(`  Mode: ${REMOTE ? 'remote' : 'local'} | ${DRY_RUN ? 'DRY RUN' : APPLY ? 'APPLY' : 'GENERATE SQL'}`)
  console.log()

  // ── Step 1: Load audit report ──────────────────────────────────────────────

  const auditPath = AUDIT_PATH ?? findLatestAudit()
  if (!auditPath) {
    console.error('❌ No audit-coverage report found. Run: npx tsx scripts/audit-attribute-coverage.ts')
    process.exit(1)
  }

  console.log(`[1/4] Loading audit report: ${auditPath}`)
  const rawAudit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as AuditResult | LegacyAuditRow[]

  const parsedTargets = (() => {
    if (Array.isArray(rawAudit)) {
      const rows = rawAudit as LegacyAuditRow[]
      const gaps = rows
        .filter((r) => r.hasQuestion === false)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((r) => ({
          key: r.key,
          characterCount: 0,
          questionsCount: 0,
          needScore: r.score ?? 0,
        }))

      const underserved = rows
        .filter((r) => r.hasQuestion !== false)
        .filter((r) => (r.flags ?? []).includes('LOW_COVERAGE') || (r.coveragePct ?? 100) <= 35)
        .sort((a, b) => (a.coveragePct ?? 999) - (b.coveragePct ?? 999))
        .map((r) => ({
          key: r.key,
          characterCount: 0,
          questionsCount: 1,
          needScore: r.score ?? 0,
        }))

      return {
        gapAttributes: gaps.slice(0, Math.floor(LIMIT / 2)),
        underservedAttributes: underserved.slice(0, Math.ceil(LIMIT / 2)),
        note: `Parsed legacy audit format with ${rows.length} rows`,
      }
    }

    const audit = rawAudit as AuditResult
    return {
      gapAttributes: audit.topGaps.slice(0, Math.floor(LIMIT / 2)),
      underservedAttributes: audit.topUnderserved.slice(0, Math.ceil(LIMIT / 2)),
      note: `Found ${audit.stats.attributesWithoutQuestions} attributes with no questions`,
    }
  })()

  const { gapAttributes, underservedAttributes } = parsedTargets
  console.log(`     ${parsedTargets.note}`)

  const targetAttributes = [...gapAttributes, ...underservedAttributes]
  const targetKeys = Array.from(new Set(targetAttributes.map((a) => a.key)))
  console.log(`     Selected ${gapAttributes.length} gaps + ${underservedAttributes.length} underserved = ${targetAttributes.length} total`)
  console.log()

  // ── Step 2: Fetch source metadata + existing questions ─────────────────────

  console.log(`[2/4] Loading attribute metadata and existing questions...`)
  console.log(`     Target attributes: ${targetKeys.join(', ')}`)

  if (targetKeys.length === 0) {
    console.log('     No target attributes selected by this audit report.')
    return
  }

  const inList = targetKeys.map(sqlQuote).join(', ')

  let definitions = d1Query(
    `SELECT key, display_text, question_text
     FROM attribute_definitions
     WHERE key IN (${inList})`
  ) as unknown as AttributeDefinitionRow[]

  let existingRows = d1Query(
    `SELECT id, attribute_key, text
     FROM questions
     WHERE attribute_key IN (${inList}) AND retired_at IS NULL`
  ) as unknown as ExistingQuestionRow[]

  let effectiveTargetKeys = targetKeys

  if (definitions.length === 0) {
    console.log('     Audit keys do not match active attribute definitions. Falling back to DB coverage query...')
    const coverageRows = d1Query(
      `SELECT
         ad.key,
         ad.display_text,
         ad.question_text,
         COUNT(DISTINCT CASE WHEN ca.value IS NOT NULL THEN ca.character_id END) as character_count,
         COUNT(DISTINCT q.id) as question_count
       FROM attribute_definitions ad
       LEFT JOIN character_attributes ca ON ca.attribute_key = ad.key
       LEFT JOIN questions q ON q.attribute_key = ad.key AND q.retired_at IS NULL
       WHERE ad.is_active = 1
       GROUP BY ad.key
       HAVING character_count > 25
       ORDER BY question_count ASC, character_count DESC
       LIMIT ${Math.max(120, LIMIT * 6)}`
    ) as unknown as CoverageRow[]

    effectiveTargetKeys = pickTargetsFromCoverage(coverageRows, LIMIT)

    if (effectiveTargetKeys.length > 0) {
      const fallbackInList = effectiveTargetKeys.map(sqlQuote).join(', ')
      definitions = d1Query(
        `SELECT key, display_text, question_text
         FROM attribute_definitions
         WHERE key IN (${fallbackInList})`
      ) as unknown as AttributeDefinitionRow[]

      existingRows = d1Query(
        `SELECT id, attribute_key, text
         FROM questions
         WHERE attribute_key IN (${fallbackInList}) AND retired_at IS NULL`
      ) as unknown as ExistingQuestionRow[]
      console.log(`     Fallback selected ${effectiveTargetKeys.length} active attributes from DB coverage`)
    }
  }

  const definitionByKey = new Map(definitions.map((row) => [row.key, row]))
  const existingByKey = new Map<string, ExistingQuestionRow[]>()
  for (const row of existingRows) {
    const arr = existingByKey.get(row.attribute_key) ?? []
    arr.push(row)
    existingByKey.set(row.attribute_key, arr)
  }

  console.log(`     Loaded ${definitions.length} attribute definitions and ${existingRows.length} existing question rows`)
  console.log()

  // ── Step 3: Generate and deduplicate candidate questions ───────────────────

  console.log(`[3/4] Building candidate questions...`)
  const candidates: CandidateQuestion[] = []

  for (const key of effectiveTargetKeys) {
    const def = definitionByKey.get(key)
    if (!def) continue

    const existing = existingByKey.get(key) ?? []
    const existingTextSet = new Set(existing.map((q) => normalizeQuestionText(q.text).toLowerCase()))

    const baseFromDisplay = renderQuestionFromDisplay(def.display_text ?? key)
    const baseFromQuestionText = def.question_text ? normalizeQuestionText(def.question_text) : null

    const rawCandidates: Array<{ text: string; source: CandidateQuestion['source'] }> = []
    const primaryQuestion = baseFromQuestionText ?? baseFromDisplay
    rawCandidates.push({ text: primaryQuestion, source: baseFromQuestionText ? 'questionText' : 'displayText' })

    if (!baseFromQuestionText) {
      rawCandidates.push({ text: baseFromDisplay, source: 'displayText' })
    }

    for (const variant of buildVariants(primaryQuestion)) {
      rawCandidates.push({ text: variant, source: 'variant' })
    }

    const seenLocal = new Set<string>()
    const maxPerAttribute = existing.length === 0 ? 2 : 1

    for (const row of rawCandidates) {
      const normalized = normalizeQuestionText(row.text)
      const k = normalized.toLowerCase()
      if (!normalized || seenLocal.has(k) || existingTextSet.has(k)) continue

      seenLocal.add(k)
      candidates.push({
        id: makeQuestionId(key, normalized),
        attributeKey: key,
        text: normalized,
        source: row.source,
      })

      if (seenLocal.size >= maxPerAttribute) break
    }
  }

  console.log(`     Built ${candidates.length} candidate questions across ${effectiveTargetKeys.length} attributes`)
  console.log()

  // ── Step 4: Write SQL and optionally apply ─────────────────────────────────

  console.log(`[4/4] Writing SQL manifest${APPLY ? ' and applying' : ''}...`)

  const datePart = new Date().toISOString().slice(0, 10)
  const sqlPath = path.join('data', `question-expansion-${datePart}.sql`)
  const jsonPath = path.join('data', `question-expansion-${datePart}.json`)

  const sqlLines = [
    '-- Generated by scripts/generate-gap-questions.ts',
    `-- Timestamp: ${new Date().toISOString()}`,
    `-- Environment: ${ENV_FLAG} (${REMOTE ? 'remote' : 'local'})`,
    '',
  ]

  for (const c of candidates) {
    sqlLines.push(
      `INSERT OR IGNORE INTO questions (id, text, attribute_key, priority) VALUES (${sqlQuote(c.id)}, ${sqlQuote(c.text)}, ${sqlQuote(c.attributeKey)}, 0.95);`
    )
  }

  fs.writeFileSync(sqlPath, `${sqlLines.join('\n')}\n`)
  fs.writeFileSync(jsonPath, `${JSON.stringify(candidates, null, 2)}\n`)

  console.log(`     Wrote SQL: ${sqlPath}`)
  console.log(`     Wrote manifest: ${jsonPath}`)

  if (APPLY && !DRY_RUN && candidates.length > 0) {
    execFileSync(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        DB_NAME,
        '--env',
        ENV_FLAG,
        REMOTE ? '--remote' : '--local',
        '--file',
        sqlPath,
      ],
      { stdio: 'inherit' }
    )
    console.log('     Apply completed.')
  } else if (DRY_RUN) {
    console.log('     [DRY RUN] SQL generated only (no DB writes).')
  }
  console.log()

  console.log(`✅ Generation summary:`)
  console.log(`   Target attributes: ${effectiveTargetKeys.length}`)
  console.log(`   Candidate questions: ${candidates.length}`)
  console.log(`   Apply mode: ${APPLY && !DRY_RUN ? 'yes' : 'no'}`)
  console.log()
  console.log(`📋 Next steps:`)
  console.log(`   1. Review generated manifest for question quality`)
  console.log(`   2. Re-run with --apply to insert into D1`) 
  console.log(`   3. Run simulation/compare to validate impact`) 
}

main()
