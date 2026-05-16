import type { GameSession, ServerCharacter } from '../_game-engine'

export function updatePosteriorHistory(
  session: GameSession,
  probs: Map<string, number>,
  filtered: ServerCharacter[],
): void {
  const sortedEntries = Array.from(probs.entries()).sort((a, b) => b[1] - a[1])
  const topProb = sortedEntries.length > 0 ? sortedEntries[0][1] : 0

  const top10 = sortedEntries.slice(0, 10).map(([id]) => {
    const character = filtered.find((candidate) => candidate.id === id)
    return { id, name: character?.name ?? id }
  })

  if (!session.posteriorHistory) session.posteriorHistory = []
  if (!session.stepTopTen) session.stepTopTen = []

  session.posteriorHistory.push(topProb)
  session.stepTopTen.push(top10)

  // Bound KV session size: keep only the most recent 30 entries.
  // At 20 questions/game (easy) this is a no-op; it only kicks in for
  // unusually long reject-then-continue chains.
  const MAX_HISTORY = 30
  if (session.posteriorHistory.length > MAX_HISTORY) {
    session.posteriorHistory = session.posteriorHistory.slice(-MAX_HISTORY)
  }
  if (session.stepTopTen.length > MAX_HISTORY) {
    session.stepTopTen = session.stepTopTen.slice(-MAX_HISTORY)
  }
}
