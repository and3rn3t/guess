import type { ReactElement } from 'react'
import type { MobilePhaseScreenProps } from './types'
import { ChallengeScreen } from './ChallengeScreen'
import { CompareScreen } from './CompareScreen'
import { GameOverScreen } from './GameOverScreen'
import { GuessingScreen } from './GuessingScreen'
import { HistoryScreen } from './HistoryScreen'
import { PlayingScreen } from './PlayingScreen'
import { PostGameFeedbackScreen } from './PostGameFeedbackScreen'
import { PreferencesScreen } from './PreferencesScreen'
import { SessionResumeScreen } from './SessionResumeScreen'
import { StatsScreen } from './StatsScreen'
import { TeachingScreen } from './TeachingScreen'
import { WelcomeScreen } from './WelcomeScreen'

/**
 * ScreenRouter
 *
 * Routes to the appropriate screen based on game phase.
 * Handles both core phases (welcome, playing, guessing, gameOver, challenge)
 * and extended phases (stats, history, compare, preferences, teaching, feedback, resume).
 *
 * **Routing Logic**:
 * - Core phases: Direct routing via CorePhaseState.phase
 * - Extended phases: Can be triggered from GameOverScreen actions
 * - Navigation state managed in server.currentScreen (future)
 */
export function ScreenRouter(props: MobilePhaseScreenProps): ReactElement {
  const { state } = props

  // Route based on core phase
  switch (state.phase) {
    case 'welcome':
      return <WelcomeScreen {...props} />
    case 'playing':
      return <PlayingScreen {...props} />
    case 'guessing':
      return <GuessingScreen {...props} />
    case 'gameOver':
      return <GameOverScreen {...props} />
    case 'challenge':
      return <ChallengeScreen {...props} />
    default: {
      // Exhaustiveness check
      const _exhaustive: never = state.phase
      return _exhaustive
    }
  }
}

/**
 * ExtendedPhaseRouter (future enhancement)
 *
 * Once extended phases are integrated into CorePhaseState, this component
 * will be merged into ScreenRouter. For now, it's a reference implementation
 * showing how to route to supplementary screens.
 *
 * Extended phases (MP.2+):
 * - 'stats': Player stats overview
 * - 'history': Game history and replay
 * - 'compare': Leaderboard comparison
 * - 'preferences': Player settings
 * - 'teaching': Interactive tutorial
 * - 'postGameFeedback': Feedback collection
 * - 'sessionResume': Session continuation prompt
 *
 * @example
 * // When integrated:
 * type ExtendedGamePhase = CoreGamePhase | 'stats' | 'history' | 'compare' | ...
 * type ExtendedPhaseState = CorePhaseState & { extendedPhase?: ExtendedGamePhase }
 * const extendedState: ExtendedPhaseState = { ...coreState, extendedPhase: 'stats' }
 * return <ExtendedPhaseRouter {...props} state={extendedState} />
 */
export function ExtendedPhaseRouter(
  props: MobilePhaseScreenProps & { extendedPhase?: string },
): ReactElement {
  const { extendedPhase } = props

  // Extended phases override core routing
  if (extendedPhase) {
    switch (extendedPhase) {
      case 'stats':
        return <StatsScreen {...props} />
      case 'history':
        return <HistoryScreen {...props} />
      case 'compare':
        return <CompareScreen {...props} />
      case 'preferences':
        return <PreferencesScreen {...props} />
      case 'teaching':
        return <TeachingScreen {...props} />
      case 'postGameFeedback':
        return <PostGameFeedbackScreen {...props} />
      case 'sessionResume':
        return <SessionResumeScreen {...props} />
      default:
        // Fall through to core router
        break
    }
  }

  // Fall back to core phase routing
  return <ScreenRouter {...props} />
}
