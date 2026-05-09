import {
  useMemo,
  useReducer,
  type PropsWithChildren,
  type ReactElement
} from 'react';
import {
  createInitialMobileGameState,
  mobileGameReducer
} from './mobileGameState';
import { MobileGameContext, type MobileGameContextValue } from './mobileGameContext';

export function MobileGameProvider({ children }: Readonly<PropsWithChildren>): ReactElement {
  const [state, dispatch] = useReducer(mobileGameReducer, undefined, createInitialMobileGameState);

  const value = useMemo<MobileGameContextValue>(
    () => ({
      state,
      dispatch
    }),
    [state]
  );

  return <MobileGameContext.Provider value={value}>{children}</MobileGameContext.Provider>;
}
