import {
  filterPossibleCharacters,
  type GameSession,
} from '../_game-engine'

export function calculateEliminatedCount(
  session: GameSession,
  filteredCount: number,
): number {
  const previousFiltered = filterPossibleCharacters(
    session.characters,
    session.answers.slice(0, -1),
    session.rejectedGuesses,
  )

  return previousFiltered.length - filteredCount
}
