import { useEffect, useState } from "react";
import {
  getSyncStatus,
  onSyncStatusChange,
  type SyncStatus,
} from "@/lib/sync";

/** Subscribes to the global sync status and returns the latest value. */
export function useSyncStatus(): SyncStatus {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    getSyncStatus(),
  );

  useEffect(() => {
    setSyncStatus(getSyncStatus());
    return onSyncStatusChange(setSyncStatus);
  }, []);

  return syncStatus;
}
