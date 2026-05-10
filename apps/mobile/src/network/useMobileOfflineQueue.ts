import { useEffect, useRef, useState } from 'react';
import {
  type MobileConnectionTone,
  useMobileConnectionStatus
} from './useMobileConnectionStatus';
import {
  flushMobileQueuedActions,
  getMobileQueuedActionCount,
  onMobileQueuedActionCountChange
} from './mobileGameApi';

export function useMobileOfflineQueue(connectionTone?: MobileConnectionTone): number {
  const connection = useMobileConnectionStatus();
  const [queuedActionCount, setQueuedActionCount] = useState(0);
  const isFlushingRef = useRef(false);
  const effectiveConnectionTone = connectionTone ?? connection.tone;

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
    if (effectiveConnectionTone === 'offline' || queuedActionCount === 0 || isFlushingRef.current) {
      return;
    }

    isFlushingRef.current = true;
    void flushMobileQueuedActions().finally(() => {
      isFlushingRef.current = false;
    });
  }, [effectiveConnectionTone, queuedActionCount]);

  return queuedActionCount;
}
