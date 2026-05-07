import { useGame } from '../src/state/GameContext'
import { PostGameFeedbackScreen } from '../src/screens/PostGameFeedbackScreen'

export default function PostGameFeedbackRoute() {
  const { dispatch, state, server } = useGame()
  return <PostGameFeedbackScreen dispatch={dispatch} state={state} server={server} />
}
