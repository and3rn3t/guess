/**
 * Legacy v1 characters endpoint — superseded by /api/v2/characters.
 * The KV-backed character store was removed as part of full KV removal.
 * Returns 410 Gone with upgrade instructions.
 */
import { errorResponse } from './_helpers'

const GONE_RESPONSE = errorResponse(
  'This endpoint has been removed. Use /api/v2/characters instead.',
  410,
)

export const onRequestGet = (): Response => GONE_RESPONSE
export const onRequestPost = (): Response => GONE_RESPONSE
