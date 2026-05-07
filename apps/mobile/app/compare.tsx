import { useGame } from '../src/state/GameContext'
import { CompareScreen } from '../src/screens/CompareScreen'

export default function CompareRoute() {
  const { dispatch, state, server } = useGame()
  return <CompareScreen dispatch={dispatch} state={state} server={server} />
}
