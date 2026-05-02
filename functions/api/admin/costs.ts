import { type Env, errorResponse, jsonResponse } from '../_helpers'

interface CostRecord {
  promptTokens: number
  completionTokens: number
  calls: number
}

function isCostRecord(value: unknown): value is CostRecord {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<CostRecord>
  return (
    typeof row.promptTokens === 'number'
    && typeof row.completionTokens === 'number'
    && typeof row.calls === 'number'
  )
}

interface DailyCostUsage {
  date: string
  promptTokens: number
  completionTokens: number
  calls: number
}

interface KvListKey {
  name: string
}

interface KvListResult {
  keys: KvListKey[]
  list_complete: boolean
  cursor?: string
}

const COST_KEY_PREFIX = 'costs:'
const COST_KEY_PATTERN = /^costs:[^:]+:(\d{4}-\d{2}-\d{2})$/

function parseWindowDays(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '7', 10)
  if (!Number.isFinite(parsed)) return 7
  return Math.min(Math.max(parsed, 1), 90)
}

function buildDateWindow(days: number): Set<string> {
  const dates = new Set<string>()
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setUTCDate(now.getUTCDate() - i)
    dates.add(date.toISOString().slice(0, 10))
  }

  return dates
}

async function listAllCostKeys(kv: KVNamespace): Promise<KvListKey[]> {
  const all: KvListKey[] = []
  let cursor: string | undefined

  do {
    const page = await kv.list({
      prefix: COST_KEY_PREFIX,
      cursor,
    }) as KvListResult

    all.push(...page.keys)
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  return all
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const url = new URL(context.request.url)
  const days = parseWindowDays(url.searchParams.get('days'))
  const dateWindow = buildDateWindow(days)
  const today = new Date().toISOString().slice(0, 10)

  const keys = await listAllCostKeys(kv)
  const byDate = new Map<string, DailyCostUsage>()

  for (const key of keys) {
    const match = COST_KEY_PATTERN.exec(key.name)
    if (!match) continue

    const date = match[1]
    if (!dateWindow.has(date)) continue

    const record = await kv.get(key.name, 'json')
    if (!isCostRecord(record)) continue

    const current = byDate.get(date) ?? {
      date,
      promptTokens: 0,
      completionTokens: 0,
      calls: 0,
    }

    current.promptTokens += record.promptTokens
    current.completionTokens += record.completionTokens
    current.calls += record.calls
    byDate.set(date, current)
  }

  const history = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  const totals = history.reduce(
    (acc, row) => {
      acc.promptTokens += row.promptTokens
      acc.completionTokens += row.completionTokens
      acc.calls += row.calls
      return acc
    },
    { promptTokens: 0, completionTokens: 0, calls: 0 },
  )

  const todayUsage = byDate.get(today) ?? {
    date: today,
    promptTokens: 0,
    completionTokens: 0,
    calls: 0,
  }

  return jsonResponse({
    source: 'kv-cost-rollup',
    windowDays: days,
    today: todayUsage,
    totals,
    history,
  })
}