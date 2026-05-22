/**
 * Legacy v1 characters endpoint — superseded by /api/v2/characters.
 * The KV-backed character store was removed as part of full KV removal.
 * Returns 410 Gone with upgrade instructions.
 */
import { errorResponse } from './_helpers'

const GONE_MSG = 'This endpoint has been removed. Use /api/v2/characters instead.'

export const onRequestGet = (): Response => errorResponse(GONE_MSG, 410)
export const onRequestPost = (): Response => errorResponse(GONE_MSG, 410)
