import type { GameSession, GuessReadiness } from '../_game-engine'

export function applyRejectCooldown(
  session: GameSession,
  readiness: GuessReadiness,
): GuessReadiness {
  const cooldownBeforeAnswer = session.postRejectCooldown
  const blockedByRejectCooldown = cooldownBeforeAnswer > 0 && !readiness.forced

  if (blockedByRejectCooldown) {
    session.postRejectCooldown = Math.max(0, cooldownBeforeAnswer - 1)
  }

  return {
    ...readiness,
    blockedByRejectCooldown,
    rejectCooldownRemaining: session.postRejectCooldown,
  }
}
