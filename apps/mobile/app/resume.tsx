import { useGame } from '../src/state/GameContext'
import { SessionResumeScreen } from '../src/screens/SessionResumeScreen'

export default function SessionResumeRoute() {
  const { dispatch, state, server } = useGame()
  return <SessionResumeScreen dispatch={dispatch} state={state} server={server} />
}
