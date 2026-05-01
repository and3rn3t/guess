/** POST /api/admin/questions/duplicates/merge */
import type { Env } from '../../../_helpers'
import { handleMerge } from './_handlers'

export const onRequestPost: PagesFunction<Env> = (context) => handleMerge(context)
