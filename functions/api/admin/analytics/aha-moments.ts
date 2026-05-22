import { type Env, jsonResponse } from '../../_helpers'
import { d1CacheGet } from '../../_d1_cache'
import type { AhaMomentSummary } from '../_aha'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const raw = await d1CacheGet<AhaMomentSummary[]>(db, 'kv:aha-moments')
  return jsonResponse({ moments: raw ?? [] })
}
