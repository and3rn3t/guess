import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  withRequestId,
} from '../_helpers'

interface DailyCostUsage {
  date: string
  promptTokens: number
  completionTokens: number
  calls: number
}

function parseWindowDays(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '7', 10)
  if (!Number.isFinite(parsed)) return 7
  return Math.min(Math.max(parsed, 1), 90)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.costs', 240)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  const url = new URL(request.url)
  const days = parseWindowDays(url.searchParams.get('days'))
  const today = new Date().toISOString().slice(0, 10)

  // KV cost tracking was superseded by Workers Analytics Engine (LLM_COSTS binding, I.2).
  // This endpoint now returns an empty result set — query LLM cost data via the
  // Cloudflare Analytics Engine SQL API or the Workers dashboard.
  return respond(jsonResponse({
    source: 'analytics-engine',
    windowDays: days,
    today: { date: today, promptTokens: 0, completionTokens: 0, calls: 0 },
    totals: { promptTokens: 0, completionTokens: 0, calls: 0 },
    history: [] as DailyCostUsage[],
  }))
}