import { type Env, errorResponse, jsonResponse } from '../../_helpers'
import { buildClosureQueueReport } from './_closure_queue'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 1), 500)
  const report = await buildClosureQueueReport(db, limit)
  return jsonResponse(report)
}