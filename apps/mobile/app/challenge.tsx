import { useGame } from '../src/state/GameContext'
import { ChallengeScreen } from '../src/screens/ChallengeScreen'

export default function ChallengeRoute() {
  const { dispatch, state, server } = useGame()
  return <ChallengeScreen dispatch={dispatch} state={state} server={server} />
}
