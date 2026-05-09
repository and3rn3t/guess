import { useEffect, useRef, useState } from 'react';
import { useMobileConnectionStatus } from './useMobileConnectionStatus';
import {
  flushMobileQueuedActions,
  getMobileQueuedActionCount,
  onMobileQueuedActionCountChange
} from './mobileGameApi';

export function useMobileOfflineQueue(): number {
  const connection = useMobileConnectionStatus();
  const [queuedActionCount, setQueuedActionCount] = useState(0);
  const isFlushingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void getMobileQueuedActionCount().then((count) => {
      if (!cancelled) {
        setQueuedActionCount(count);
      }
    });

    const unsubscribe = onMobileQueuedActionCountChange(setQueuedActionCount);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (connection.tone === 'offline' || queuedActionCount === 0 || isFlushingRef.current) {
      return;
    }

    isFlushingRef.current = true;
    void flushMobileQueuedActions().finally(() => {
      isFlushingRef.current = false;
    });
  }, [connection.tone, queuedActionCount]);

  return queuedActionCount;
}
