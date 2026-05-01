/** POST /api/admin/questions/duplicates/backfill */
import type { Env } from '../../../_helpers'
import { handleBackfill } from './_handlers'

export const onRequestPost: PagesFunction<Env> = (context) => handleBackfill(context)
