import { useEffect, useRef, useState } from "react";

/**
 * Tracks per-step elimination counts driven by `serverRemaining`.
 *
 * - Flashes `eliminatedCount` for 2s after each drop in remaining.
 * - Records each new `serverRemaining` to `remainingHistoryRef` so
 *   downstream UI can compute per-question elimination deltas.
 *
 * Call `reset()` when starting a new game.
 */
export function useEliminationTracker(serverRemaining: number) {
  const [eliminatedCount, setEliminatedCount] = useState<number | null>(null);
  const prevPossibleCount = useRef<number>(0);
  const remainingHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const eliminated = prevPossibleCount.current - serverRemaining;
    if (prevPossibleCount.current > 0 && eliminated > 0) {
      setEliminatedCount(eliminated);
      const t = setTimeout(() => setEliminatedCount(null), 2000);
      remainingHistoryRef.current.push(serverRemaining);
      prevPossibleCount.current = serverRemaining;
      return () => clearTimeout(t);
    }
    prevPossibleCount.current = serverRemaining;
  }, [serverRemaining]);

  const reset = () => {
    remainingHistoryRef.current = [];
    prevPossibleCount.current = 0;
    setEliminatedCount(null);
  };

  return { eliminatedCount, remainingHistoryRef, reset };
}
