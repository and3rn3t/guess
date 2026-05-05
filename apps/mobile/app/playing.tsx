import { useGame } from '../src/state/GameContext'
import { PlayingScreen } from '../src/screens/PlayingScreen'

export default function PlayingRoute() {
  const { dispatch, state, server } = useGame()
  return <PlayingScreen dispatch={dispatch} state={state} server={server} />
}
