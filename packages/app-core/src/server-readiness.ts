export interface RejectCooldownLike {
  rejectCooldownRemaining?: number
}

export const getRejectCooldownRemaining = (
  readiness?: RejectCooldownLike | null,
): number => readiness?.rejectCooldownRemaining ?? 0

export const formatRejectCooldownSuffix = (remaining: number): string =>
  remaining > 0 ? ` (${remaining} more before next guess)` : ''

export const buildCollectingEvidenceMessage = (remaining: number): string =>
  `Collecting more evidence before guessing${formatRejectCooldownSuffix(remaining)}`

export const buildRetryGuessMessage = (remaining: number): string =>
  `I'll keep trying — let me ask more questions${formatRejectCooldownSuffix(remaining)}!`