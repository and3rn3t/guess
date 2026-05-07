import { useGame } from '../src/state/GameContext'
import { StatsScreen } from '../src/screens/StatsScreen'

export default function StatsRoute() {
  const { dispatch, state, server } = useGame()
  return <StatsScreen dispatch={dispatch} state={state} server={server} />
}
