export type ServerRejectResponseKind = 'question' | 'exhausted' | 'unknown'

export interface ServerRejectResponseLike {
  type?: string
  question?: unknown
  reasoning?: unknown
  rejectCooldownRemaining?: number
}

export interface RejectReadinessSnapshot {
  trigger: 'insufficient_data'
  blockedByRejectCooldown: boolean
  rejectCooldownRemaining: number
}

export const classifyServerRejectResponse = (
  response: ServerRejectResponseLike,
): ServerRejectResponseKind => {
  if (response.type === 'exhausted') {
    return 'exhausted'
  }
  if (response.type === 'question' && response.question && response.reasoning) {
    return 'question'
  }
  return 'unknown'
}

export const buildRejectReadinessSnapshot = (
  cooldownRemaining?: number,
): RejectReadinessSnapshot => {
  const rejectCooldownRemaining = cooldownRemaining ?? 0
  return {
    trigger: 'insufficient_data',
    blockedByRejectCooldown: rejectCooldownRemaining > 0,
    rejectCooldownRemaining,
  }
}