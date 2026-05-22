/// <reference types="@cloudflare/workers-types" />
/**
 * H.4 — POST /api/admin/resolve-stack
 *
 * Pretty-prints a minified production stack trace by resolving each frame
 * against source maps stored in R2 (`maps/{commit_sha}/{asset}.map`).
 *
 * Body: { stack: string, sha?: string }
 *   - `stack`: the raw `.stack` string from an `error_logs.detail` row.
 *   - `sha`:   required. Commit SHA identifying which R2 directory to read from.
 *
 * Response: { sha, frames: Array<ResolvedFrame> }
 *
 * Protected by the admin Basic-auth gate in `functions/_middleware.ts`.
 */
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js'
import { type Env, errorResponse, jsonResponse, parseJsonBodyWithSchema } from '../_helpers'
import { z } from 'zod'

const BodySchema = z.object({
  stack: z.string().min(1).max(64_000),
  sha: z.string().regex(/^[a-f0-9]{7,40}$/i).optional(),
})

interface ResolvedFrame {
  raw: string
  resolved: { source: string; line: number; column: number; name: string | null } | null
  reason?: string
}

/**
 * Match the two stack frame shapes the v8 runtime emits:
 *   "    at fn (https://andernator.com/assets/index-abc.js:42:13)"
 *   "    at https://andernator.com/assets/index-abc.js:42:13"
 * Capture the asset filename, line, and column.
 */
const FRAME_RX = /\/assets\/([\w.-]+\.js):(\d+):(\d+)/

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  if (!env.GUESS_IMAGES) return errorResponse('R2 not configured', 503)

  const parsed = await parseJsonBodyWithSchema(context.request, BodySchema)
  if (!parsed.success) return parsed.response
  const { stack } = parsed.data

  const sha = parsed.data.sha
  if (!sha) {
    return errorResponse(
      'No deploy SHA — pass `sha` in the request body.',
      400,
    )
  }

  // Cache parsed consumers per asset within this request to avoid re-parsing
  // when many frames share a chunk.
  const consumers = new Map<string, SourceMapConsumer | null>()
  async function getConsumer(asset: string): Promise<SourceMapConsumer | null> {
    if (consumers.has(asset)) return consumers.get(asset) ?? null
    const obj = await env.GUESS_IMAGES.get(`maps/${sha}/${asset}.map`)
    if (!obj) {
      consumers.set(asset, null)
      return null
    }
    try {
      const raw = (await obj.json()) as RawSourceMap
      const consumer = new SourceMapConsumer(raw)
      consumers.set(asset, consumer)
      return consumer
    } catch {
      consumers.set(asset, null)
      return null
    }
  }

  const frames: ResolvedFrame[] = []
  for (const line of stack.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(FRAME_RX)
    if (!match) {
      frames.push({ raw: trimmed, resolved: null, reason: 'no asset/line/col match' })
      continue
    }
    const [, asset, lineStr, colStr] = match
    const consumer = await getConsumer(asset)
    if (!consumer) {
      frames.push({ raw: trimmed, resolved: null, reason: `no map for ${asset} @ sha=${sha}` })
      continue
    }
    const pos = consumer.originalPositionFor({ line: Number(lineStr), column: Number(colStr) })
    if (!pos.source) {
      frames.push({ raw: trimmed, resolved: null, reason: 'unmapped position' })
      continue
    }
    frames.push({
      raw: trimmed,
      resolved: {
        source: pos.source,
        line: pos.line ?? 0,
        column: pos.column ?? 0,
        name: pos.name ?? null,
      },
    })
  }

  return jsonResponse({ sha, frames })
}
