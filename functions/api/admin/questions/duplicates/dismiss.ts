/** POST /api/admin/questions/duplicates/dismiss */
import type { Env } from '../../../_helpers'
import { handleDismiss } from './_handlers'

export const onRequestPost: PagesFunction<Env> = (context) => handleDismiss(context)
