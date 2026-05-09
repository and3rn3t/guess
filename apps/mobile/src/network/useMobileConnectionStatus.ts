import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

export type MobileConnectionTone = 'online' | 'limited' | 'offline';

export interface MobileConnectionStatus {
  tone: MobileConnectionTone;
  label: string;
  detail: string;
}

interface NetworkSnapshot {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
}

function toSnapshot(state: Network.NetworkState): NetworkSnapshot {
  return {
    isConnected: state.isConnected ?? null,
    isInternetReachable: state.isInternetReachable ?? null,
    type: state.type ?? null
  };
}

function summarizeConnection(snapshot: NetworkSnapshot): MobileConnectionStatus {
  if (snapshot.isConnected === false || snapshot.isInternetReachable === false) {
    return {
      tone: 'offline',
      label: 'Offline',
      detail: 'Actions will retry when the device reconnects.'
    };
  }

  if (snapshot.type === 'cellular') {
    return {
      tone: 'limited',
      label: 'Cellular connection',
      detail: 'Network is reachable, but responses may be slower on mobile data.'
    };
  }

  return {
    tone: 'online',
    label: 'Connected',
    detail: 'Network is available and API calls can proceed normally.'
  };
}

export function useMobileConnectionStatus(): MobileConnectionStatus {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>({
    isConnected: null,
    isInternetReachable: null,
    type: null
  });

  useEffect(() => {
    let cancelled = false;

    const updateSnapshot = async (): Promise<void> => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) {
          setSnapshot(toSnapshot(state));
        }
      } catch {
        if (!cancelled) {
          setSnapshot({ isConnected: false, isInternetReachable: false, type: null });
        }
      }
    };

    void updateSnapshot();

    const subscription = Network.addNetworkStateListener((state) => {
      setSnapshot(toSnapshot(state));
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void updateSnapshot();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return summarizeConnection(snapshot);
}
