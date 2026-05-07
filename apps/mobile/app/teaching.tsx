import { useGame } from '../src/state/GameContext'
import { TeachingScreen } from '../src/screens/TeachingScreen'

export default function TeachingRoute() {
  const { dispatch, state, server } = useGame()
  return <TeachingScreen dispatch={dispatch} state={state} server={server} />
}
