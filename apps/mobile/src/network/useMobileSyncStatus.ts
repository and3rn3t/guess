import { useEffect, useState } from 'react';
import {
  getMobileSyncStatus,
  onMobileSyncStatusChange,
  type MobileSyncStatus
} from './mobileGameApi';

export function useMobileSyncStatus(): MobileSyncStatus {
  const [syncStatus, setSyncStatus] = useState<MobileSyncStatus>(() => getMobileSyncStatus());

  useEffect(() => {
    setSyncStatus(getMobileSyncStatus());
    return onMobileSyncStatusChange(setSyncStatus);
  }, []);

  return syncStatus;
}
