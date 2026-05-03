import { useCallback, useEffect, useState } from "react";
import {
  fetchDailyChallengeStatus,
  fetchDailyLeaderboard,
  recordDailyChallengeResult,
} from "@/lib/gameApi";
import type { DailyChallengeStatus, DailyLeaderboardEntry } from "@/lib/types";

interface UseDailyChallengeState {
  status: DailyChallengeStatus | null;
  leaderboard: DailyLeaderboardEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordCompletion: (won: boolean, questionsAsked: number) => Promise<void>;
}

export function useDailyChallenge(): UseDailyChallengeState {
  const [status, setStatus] = useState<DailyChallengeStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await fetchDailyChallengeStatus();
      setStatus(nextStatus);

      const board = await fetchDailyLeaderboard(nextStatus.date);
      setLeaderboard(board.leaderboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load daily challenge";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const recordCompletion = useCallback(
    async (won: boolean, questionsAsked: number) => {
      await recordDailyChallengeResult(won, questionsAsked);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, leaderboard, loading, error, refresh, recordCompletion };
}
