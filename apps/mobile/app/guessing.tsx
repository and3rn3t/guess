import { useGame } from '../src/state/GameContext'
import { GuessingScreen } from '../src/screens/GuessingScreen'

export default function GuessingRoute() {
  const { dispatch, state, server } = useGame()
  return <GuessingScreen dispatch={dispatch} state={state} server={server} />
}
