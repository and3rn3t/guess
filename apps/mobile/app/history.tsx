import { useGame } from '../src/state/GameContext'
import { HistoryScreen } from '../src/screens/HistoryScreen'

export default function HistoryRoute() {
  const { dispatch, state, server } = useGame()
  return <HistoryScreen dispatch={dispatch} state={state} server={server} />
}
