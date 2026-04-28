import { DIFFICULTIES } from "@/lib/types";
import type { Difficulty, GameHistoryEntry } from "@/lib/types";
import type { GamePhase } from "@/hooks/useGameState";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Shows a one-shot toast suggesting the next difficulty level when the user
 * wins ≥ 80% of their last 10 games at the current difficulty.
 * Only fires once per session (guarded by a ref) and only on the welcome screen.
 */
export function useAdaptiveDifficulty(
  gamePhase: GamePhase,
  difficulty: Difficulty,
  gameHistory: GameHistoryEntry[] | undefined,
  setDifficulty: (d: Difficulty) => void,
): void {
  const shownRef = useRef(false);

  useEffect(() => {
    if (gamePhase !== "welcome") return;
    if (shownRef.current) return;
    if (difficulty === "hard") return;
    if (!gameHistory || gameHistory.length < 10) return;

    const nextDifficulty: Record<string, string> = {
      easy: "Medium",
      medium: "Hard",
    };
    const next = nextDifficulty[difficulty];
    if (!next) return;

    const last10 = gameHistory
      .filter((g) => g.difficulty === difficulty)
      .slice(-10);
    if (last10.length < 10) return;

    const winRate = last10.filter((g) => g.won).length / last10.length;
    if (winRate >= 0.8) {
      shownRef.current = true;
      const wins = Math.round(winRate * 10);
      toast(
        `You've won ${wins}/10 on ${DIFFICULTIES[difficulty].label} — ready for ${next}?`,
        {
          duration: 6000,
          action: {
            label: `Try ${next}`,
            onClick: () =>
              setDifficulty(difficulty === "easy" ? "medium" : "hard"),
          },
        },
      );
    }
  }, [gamePhase, difficulty, gameHistory, setDifficulty]);
}
