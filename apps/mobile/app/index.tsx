import { useGame } from '../src/state/GameContext'
import { WelcomeScreen } from '../src/screens/WelcomeScreen'

export default function WelcomeRoute() {
  const { dispatch, state, server } = useGame()
  return <WelcomeScreen dispatch={dispatch} state={state} server={server} />
}
