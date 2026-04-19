import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Tracks navigator.onLine and fires a toast when going offline.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      toast.warning(
        "You're offline — the game won't work until you reconnect.",
      );
    };
    globalThis.addEventListener("online", goOnline);
    globalThis.addEventListener("offline", goOffline);
    return () => {
      globalThis.removeEventListener("online", goOnline);
      globalThis.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
