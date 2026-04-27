import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../../../_helpers'
import type { ProposedAttributesRow } from '../../_db-types'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const id = context.params.id as string
  const numId = parseInt(id, 10)
  if (!numId || isNaN(numId)) return errorResponse('Invalid proposal ID', 400)

  const body = await parseJsonBody<{ action?: string }>(context.request)
  if (!body?.action) return errorResponse('Missing action', 400)

  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return errorResponse('action must be "approve" or "reject"', 400)
  }

  // Fetch the proposal
  const proposal = await db
    .prepare('SELECT * FROM proposed_attributes WHERE id = ?')
    .bind(numId)
    .first<ProposedAttributesRow>()

  if (!proposal) return errorResponse('Proposal not found', 404)
  if (proposal.status !== 'pending') {
    return errorResponse(`Proposal already ${proposal.status}`, 409)
  }

  const now = Math.floor(Date.now() / 1000)

  if (action === 'approve') {
    // Insert into attribute_definitions (ignore if key already exists)
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO attribute_definitions (key, display_text, question_text, is_active, created_at)
         VALUES (?, ?, ?, 1, ?)`
      ).bind(proposal.key, proposal.display_text, proposal.question_text, now),
      db.prepare(
        `UPDATE proposed_attributes SET status = 'approved', reviewed_at = ? WHERE id = ?`
      ).bind(now, numId),
    ])
    return jsonResponse({ ok: true, action: 'approved', key: proposal.key })
  }

  // reject
  await db
    .prepare(`UPDATE proposed_attributes SET status = 'rejected', reviewed_at = ? WHERE id = ?`)
    .bind(now, numId)
    .run()

  return jsonResponse({ ok: true, action: 'rejected' })
}
