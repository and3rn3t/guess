import { useGame } from '../src/state/GameContext'
import { GameOverScreen } from '../src/screens/GameOverScreen'

export default function GameOverRoute() {
  const { dispatch, state, server } = useGame()
  return <GameOverScreen dispatch={dispatch} state={state} server={server} />
}
