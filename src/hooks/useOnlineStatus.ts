import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Tracks navigator.onLine and fires a toast when going offline
 * while LLM mode or server mode is active.
 */
export function useOnlineStatus(llmMode: boolean, serverMode = false): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      if (serverMode) {
        toast.warning(
          "You're offline — Server mode won't work until you reconnect.",
        );
      } else if (llmMode) {
        toast.warning(
          "You're offline — AI-Enhanced features won't work until you reconnect.",
        );
      }
    };
    globalThis.addEventListener("online", goOnline);
    globalThis.addEventListener("offline", goOffline);
    return () => {
      globalThis.removeEventListener("online", goOnline);
      globalThis.removeEventListener("offline", goOffline);
    };
  }, [llmMode, serverMode]);

  return online;
}
