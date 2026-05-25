import { Button } from "@/components/ui/button";
import { SparkleIcon } from "@phosphor-icons/react";

import type { DifficultyFilter } from "./questionsTypes";

interface BulkActionsBarProps {
  selectedCount: number;
  bulkScoring: boolean;
  bulkScoreProgress: { done: number; total: number };
  bulkUpdating: boolean;
  bulkDifficulty: DifficultyFilter;
  setBulkDifficulty: (value: DifficultyFilter) => void;
  scoreSelectedQuestions: () => void;
  runBulkUpdate: (payload: {
    isActive?: boolean;
    difficulty?: "easy" | "medium" | "hard" | null;
  }) => void;
  applyBulkDifficulty: () => void;
}

export function BulkActionsBar({
  selectedCount,
  bulkScoring,
  bulkScoreProgress,
  bulkUpdating,
  bulkDifficulty,
  setBulkDifficulty,
  scoreSelectedQuestions,
  runBulkUpdate,
  applyBulkDifficulty,
}: BulkActionsBarProps): React.JSX.Element | null {
  if (selectedCount === 0) return null;

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-violet-400">
          {selectedCount} selected
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkScoring}
          onClick={() => scoreSelectedQuestions()}
          className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
        >
          <SparkleIcon size={12} className="mr-1.5" />
          {bulkScoring
            ? `Scoring ${bulkScoreProgress.done}/${bulkScoreProgress.total}`
            : "AI Score Selected"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkUpdating}
          onClick={() => runBulkUpdate({ isActive: true })}
          className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
        >
          Activate
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkUpdating}
          onClick={() => runBulkUpdate({ isActive: false })}
          className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
        >
          Deactivate
        </Button>
        <select
          value={bulkDifficulty}
          onChange={(event) =>
            setBulkDifficulty(event.target.value as DifficultyFilter)
          }
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          aria-label="Bulk difficulty"
        >
          <option value="all">Bulk difficulty...</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="unset">Clear difficulty</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkUpdating || bulkDifficulty === "all"}
          onClick={() => applyBulkDifficulty()}
          className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
        >
          Apply Difficulty
        </Button>
      </div>
    </div>
  );
}
