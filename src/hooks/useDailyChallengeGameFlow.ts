import { useCallback, useState } from "react";
import type { DailyChallengeStatus } from "@/lib/types";

interface UseDailyChallengeGameFlowInput {
  dailyChallenge: DailyChallengeStatus | null;
  recordDailyCompletion: (won: boolean, questionsAsked: number) => Promise<void>;
}

interface UseDailyChallengeGameFlowResult {
  activateDailyChallenge: (date: string) => void;
  clearActiveDailyChallenge: () => void;
  onGameCompleted: (won: boolean, questionsAsked: number) => void;
}

export function useDailyChallengeGameFlow({
  dailyChallenge,
  recordDailyCompletion,
}: UseDailyChallengeGameFlowInput): UseDailyChallengeGameFlowResult {
  const [activeDailyDate, setActiveDailyDate] = useState<string | null>(null);

  const activateDailyChallenge = useCallback((date: string): void => {
    setActiveDailyDate(date);
  }, []);

  const clearActiveDailyChallenge = useCallback((): void => {
    setActiveDailyDate(null);
  }, []);

  const onGameCompleted = useCallback(
    (won: boolean, questionsAsked: number): void => {
      if (!activeDailyDate || activeDailyDate !== dailyChallenge?.date) return;
      void recordDailyCompletion(won, questionsAsked);
      setActiveDailyDate(null);
    },
    [activeDailyDate, dailyChallenge, recordDailyCompletion],
  );

  return {
    activateDailyChallenge,
    clearActiveDailyChallenge,
    onGameCompleted,
  };
}
