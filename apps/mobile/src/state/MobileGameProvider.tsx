import { useEffect, useMemo, useReducer, useRef, type PropsWithChildren, type ReactElement } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { flushMobileQueuedActions } from '../network/mobileGameApi';
import {
  createInitialMobileGameState,
  mobileGameReducer
} from './mobileGameState';
import { MobileGameContext, type MobileGameContextValue } from './mobileGameContext';
import { loadActiveSessionId, saveActiveSessionId } from './mobileSessionDurability';

export function MobileGameProvider({ children }: Readonly<PropsWithChildren>): ReactElement {
  const [state, dispatch] = useReducer(mobileGameReducer, undefined, createInitialMobileGameState);
  const lastPersistedSessionRef = useRef<string | null>(null);

  // On cold-start, restore the last known session ID so WelcomeScreen
  // can offer the Resume button without requiring a network call.
  useEffect(() => {
    let cancelled = false;
    void loadActiveSessionId().then((id) => {
      if (!cancelled && id !== null) {
        dispatch({ type: 'RESTORE_SESSION_ID', sessionId: id });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist lastSessionId to AsyncStorage whenever it changes.
  useEffect(() => {
    if (state.lastSessionId === lastPersistedSessionRef.current) {
      return;
    }
    lastPersistedSessionRef.current = state.lastSessionId;
    void saveActiveSessionId(state.lastSessionId);
  }, [state.lastSessionId]);

  // Flush offline-queued actions when the app returns to foreground.
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        void flushMobileQueuedActions();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo<MobileGameContextValue>(
    () => ({
      state,
      dispatch
    }),
    [state]
  );

  return <MobileGameContext.Provider value={value}>{children}</MobileGameContext.Provider>;
}
