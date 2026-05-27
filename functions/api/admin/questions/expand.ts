import {
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
} from '../../_helpers'
import { d1CacheGet, d1CachePut } from '../../_d1_cache'
import { z } from 'zod'

const BodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  minCharacterCount: z.number().int().min(0).max(50000).optional(),
  maxPerAttribute: z.number().int().min(1).max(3).optional(),
  dryRun: z.boolean().optional(),
})

interface CoverageRow {
  key: string
  display_text: string | null
  question_text: string | null
  character_count: number
  question_count: number
}

interface ExistingQuestionRow {
  id: string
  attribute_key: string
  text: string
}

interface CandidateQuestion {
  id: string
  attributeKey: string
  text: string
}

interface ExpansionRunHistoryEntry {
  requestId: string
  actorId: string
  dryRun: boolean
  limit: number
  minCharacterCount: number
  maxPerAttribute: number
  targetAttributes: number
  candidates: number
  inserted: number
  createdAt: string
  status: 'success' | 'error'
  error?: string
}

const RUN_HISTORY_KEY = 'admin:questions:expansion-runs'
const RUN_HISTORY_MAX = 20

function normalizeQuestionText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed
  const withQuestion = trimmed.endsWith('?') ? trimmed : `${trimmed}?`
  return `${withQuestion.charAt(0).toUpperCase()}${withQuestion.slice(1)}`
}

function shortHash(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function makeQuestionId(attributeKey: string, text: string): string {
  return `qg_${attributeKey}_${shortHash(text)}`
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
    return [q, normalizeQuestionText(q.replace(/^is this character /i, 'Would this character be considered '))]
  }

  if (lower.startsWith('does this character ')) {
    return [q, normalizeQuestionText(q.replace(/^does this character /i, 'Is this character known to '))]
  }

  if (lower.startsWith('can this character ')) {
    return [q, normalizeQuestionText(q.replace(/^can this character /i, 'Is this character able to '))]
  }

  return [q]
}

function selectTargets(rows: CoverageRow[], limit: number): CoverageRow[] {
  const zeroQuestion = rows
    .filter((r) => r.question_count === 0)
    .sort((a, b) => b.character_count - a.character_count)
    .slice(0, Math.floor(limit / 2))

  const underserved = rows
    .filter((r) => r.question_count > 0 && r.question_count < 2)
    .sort((a, b) => b.character_count - a.character_count)
    .slice(0, Math.ceil(limit / 2))

  const map = new Map<string, CoverageRow>()
  for (const row of [...zeroQuestion, ...underserved]) {
    map.set(row.key, row)
  }
  return Array.from(map.values())
}

async function appendRunHistory(
  db: D1Database | undefined,
  entry: ExpansionRunHistoryEntry,
): Promise<void> {
  if (!db) return
  const runs = (await d1CacheGet<ExpansionRunHistoryEntry[]>(db, RUN_HISTORY_KEY)) ?? []
  runs.unshift(entry)
  await d1CachePut(db, RUN_HISTORY_KEY, runs.slice(0, RUN_HISTORY_MAX))
}

interface ExpansionOptions {
  db: D1Database
  limit: number
  minCharacterCount: number
  maxPerAttribute: number
  dryRun: boolean
}

interface ExpansionResult {
  targetAttributes: number
  candidates: number
  inserted: number
  sample: CandidateQuestion[]
}

async function runExpansion(options: ExpansionOptions): Promise<ExpansionResult> {
  const { db, limit, minCharacterCount, maxPerAttribute, dryRun } = options
  const coverage = await db
    .prepare(
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
       HAVING character_count >= ?
       ORDER BY question_count ASC, character_count DESC
       LIMIT ?`
    )
    .bind(minCharacterCount, Math.max(120, limit * 6))
    .all<CoverageRow>()

  const targetRows = selectTargets(coverage.results ?? [], limit)
  const targetKeys = targetRows.map((row) => row.key)

  if (targetKeys.length === 0) {
    return {
      targetAttributes: 0,
      candidates: 0,
      inserted: 0,
      sample: [],
    }
  }

  const placeholders = targetKeys.map(() => '?').join(',')
  const existingResult = await db
    .prepare(
      `SELECT id, attribute_key, text
       FROM questions
       WHERE attribute_key IN (${placeholders}) AND retired_at IS NULL`
    )
    .bind(...targetKeys)
    .all<ExistingQuestionRow>()

  const existingByKey = new Map<string, ExistingQuestionRow[]>()
  for (const row of existingResult.results ?? []) {
    const arr = existingByKey.get(row.attribute_key) ?? []
    arr.push(row)
    existingByKey.set(row.attribute_key, arr)
  }

  const candidates: CandidateQuestion[] = []
  for (const row of targetRows) {
    const existing = existingByKey.get(row.key) ?? []
    const existingTextSet = new Set(existing.map((q) => normalizeQuestionText(q.text).toLowerCase()))

    const baseFromDisplay = renderQuestionFromDisplay(row.display_text ?? row.key)
    const baseFromQuestionText = row.question_text ? normalizeQuestionText(row.question_text) : null
    const primaryQuestion = baseFromQuestionText ?? baseFromDisplay

    const raw = [
      { text: primaryQuestion },
      ...(baseFromQuestionText ? [] : [{ text: baseFromDisplay }]),
      ...buildVariants(primaryQuestion).map((text) => ({ text })),
    ]

    const seen = new Set<string>()
    const perAttributeCap = existing.length === 0 ? Math.min(2, maxPerAttribute) : Math.min(1, maxPerAttribute)

    for (const item of raw) {
      const normalized = normalizeQuestionText(item.text)
      const key = normalized.toLowerCase()
      if (!normalized || seen.has(key) || existingTextSet.has(key)) continue

      seen.add(key)
      candidates.push({
        id: makeQuestionId(row.key, normalized),
        attributeKey: row.key,
        text: normalized,
      })

      if (seen.size >= perAttributeCap) break
    }
  }

  let inserted = 0
  if (!dryRun && candidates.length > 0) {
    const statements = candidates.map((c) =>
      db.prepare(
        'INSERT OR IGNORE INTO questions (id, text, attribute_key, priority) VALUES (?, ?, ?, 0.95)'
      ).bind(c.id, c.text, c.attributeKey)
    )
    const results = await db.batch(statements)
    inserted = results.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0)
  }

  return {
    targetAttributes: targetRows.length,
    candidates: candidates.length,
    inserted,
    sample: candidates.slice(0, 10),
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const requestId = getRequestId(context.request)
  const runs = (await d1CacheGet<ExpansionRunHistoryEntry[]>(context.env.GUESS_DB, RUN_HISTORY_KEY)) ?? []
  return withRequestId(
    jsonResponse({
      ok: true,
      requestId,
      runs,
    }),
    requestId,
  )
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)
  const db = env.GUESS_DB

  if (!db) {
    return withRequestId(errorResponse('D1 not configured', 503), requestId)
  }

  const parsed = await parseJsonBodyWithSchema(request, BodySchema)
  if (!parsed.success) {
    return withRequestId(parsed.response, requestId)
  }

  const limit = parsed.data.limit ?? 40
  const minCharacterCount = parsed.data.minCharacterCount ?? 25
  const maxPerAttribute = parsed.data.maxPerAttribute ?? 2
  const dryRun = parsed.data.dryRun ?? false

  try {
    const run = await runExpansion({
      db,
      limit,
      minCharacterCount,
      maxPerAttribute,
      dryRun,
    })

    await appendRunHistory(env.GUESS_DB, {
      requestId,
      actorId,
      dryRun,
      limit,
      minCharacterCount,
      maxPerAttribute,
      targetAttributes: run.targetAttributes,
      candidates: run.candidates,
      inserted: run.inserted,
      createdAt: new Date().toISOString(),
      status: 'success',
    })

    return withRequestId(
      jsonResponse({
        ok: true,
        requestId,
        dryRun,
        targetAttributes: run.targetAttributes,
        candidates: run.candidates,
        inserted: run.inserted,
        sample: run.sample,
      }),
      requestId,
    )
  } catch (err) {
    void appendRunHistory(env.GUESS_DB, {
      requestId,
      actorId,
      dryRun,
      limit,
      minCharacterCount,
      maxPerAttribute,
      targetAttributes: 0,
      candidates: 0,
      inserted: 0,
      createdAt: new Date().toISOString(),
      status: 'error',
      error: err instanceof Error ? err.message.slice(0, 300) : 'Unknown error',
    })

    context.waitUntil(
      logError(env, 'admin.questions.expand', 'error', 'Question expansion failed', err, {
        requestId,
        actorId,
        path: new URL(request.url).pathname,
        method: request.method,
      })
    )
    return withRequestId(
      errorResponse(`Question expansion failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500),
      requestId,
    )
  }
}
