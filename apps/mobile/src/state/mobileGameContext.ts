import { createContext, type Dispatch } from 'react';
import type { MobileGameAction, MobileGameState } from './mobileGameState';

export interface MobileGameContextValue {
  state: MobileGameState;
  dispatch: Dispatch<MobileGameAction>;
}

export const MobileGameContext = createContext<MobileGameContextValue | null>(null);
