/**
 * GET/POST /api/admin/workflow-progress — shared Mission Control workflow state.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getRequestId,
  jsonResponse,
  withRequestId,
} from '../_helpers'

interface WorkflowProgressRecord {
  activeTo: string | null
  completed: boolean
}

type WorkflowProgressMap = Record<string, WorkflowProgressRecord>

interface StoredWorkflowProgress {
  progress: WorkflowProgressMap
  updatedAt: number
  updatedBy: string
}

const WORKFLOW_PROGRESS_KEY = 'admin:mission-control:workflow-progress'

function isWorkflowProgressMap(value: unknown): value is WorkflowProgressMap {
  if (typeof value !== 'object' || value === null) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > 30) return false

  return entries.every(([key, record]) => {
    if (!key || key.length > 80) return false
    if (typeof record !== 'object' || record === null) return false
    const item = record as Record<string, unknown>
    const activeToValid = item.activeTo === null || typeof item.activeTo === 'string'
    const completedValid = typeof item.completed === 'boolean'
    return activeToValid && completedValid
  })
}

function parseStored(value: unknown): StoredWorkflowProgress | null {
  if (typeof value !== 'object' || value === null) return null
  const parsed = value as Record<string, unknown>
  if (!isWorkflowProgressMap(parsed.progress)) return null
  if (typeof parsed.updatedAt !== 'number') return null
  if (typeof parsed.updatedBy !== 'string') return null
  return {
    progress: parsed.progress,
    updatedAt: parsed.updatedAt,
    updatedBy: parsed.updatedBy,
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.workflow-progress.read', 600)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  const kv = env.GUESS_ASSETS ?? env.GUESS_KV
  if (!kv) return respond(errorResponse('KV not configured', 503))

  const raw = await kv.get(WORKFLOW_PROGRESS_KEY, 'json')
  const stored = parseStored(raw)

  return respond(jsonResponse({
    progress: stored?.progress ?? {},
    updatedAt: stored?.updatedAt ?? null,
    updatedBy: stored?.updatedBy ?? null,
  }))
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.workflow-progress.write', 240)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  const kv = env.GUESS_ASSETS ?? env.GUESS_KV
  if (!kv) return respond(errorResponse('KV not configured', 503))

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return respond(errorResponse('Invalid JSON body', 400))
  }

  if (typeof body !== 'object' || body === null) {
    return respond(errorResponse('Invalid workflow progress payload', 400))
  }

  const payload = body as { progress?: unknown }
  if (!isWorkflowProgressMap(payload.progress)) {
    return respond(errorResponse('Invalid workflow progress payload', 400))
  }

  const stored: StoredWorkflowProgress = {
    progress: payload.progress,
    updatedAt: Date.now(),
    updatedBy: actorId,
  }

  await kv.put(WORKFLOW_PROGRESS_KEY, JSON.stringify(stored))

  return respond(jsonResponse({
    ok: true,
    progress: stored.progress,
    updatedAt: stored.updatedAt,
    updatedBy: stored.updatedBy,
  }))
}
