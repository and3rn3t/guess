import type { CorePhaseAction, CorePhaseState } from '@guess/app-core'
import type { Dispatch } from 'react'
import type { MobileServerGameActions, MobileServerGameState } from '../state/useMobileServerGame'

export interface MobilePhaseScreenProps {
  dispatch: Dispatch<CorePhaseAction>
  state: CorePhaseState
  server: MobileServerGameState & MobileServerGameActions
}
