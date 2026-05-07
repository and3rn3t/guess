import { useGame } from '../src/state/GameContext'
import { PreferencesScreen } from '../src/screens/PreferencesScreen'

export default function PreferencesRoute() {
  const { dispatch, state, server } = useGame()
  return <PreferencesScreen dispatch={dispatch} state={state} server={server} />
}
