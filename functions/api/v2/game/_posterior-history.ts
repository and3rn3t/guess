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
}
