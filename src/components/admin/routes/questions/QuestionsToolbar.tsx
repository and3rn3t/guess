import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { isValidMinUsageInput } from "./questionsHelpers";
import type {
  ActiveFilter,
  DifficultyFilter,
  QuestionSort,
  QuickPreset,
  SortOrder,
  TextStatusFilter,
} from "./questionsTypes";

interface QuestionsToolbarProps {
  activeFilter: ActiveFilter;
  setActiveFilter: (value: ActiveFilter) => void;
  difficultyFilter: DifficultyFilter;
  setDifficultyFilter: (value: DifficultyFilter) => void;
  textStatusFilter: TextStatusFilter;
  setTextStatusFilter: (value: TextStatusFilter) => void;
  minUsage: string;
  setMinUsage: (value: string) => void;
  sort: QuestionSort;
  setSort: (value: QuestionSort) => void;
  order: SortOrder;
  toggleOrder: () => void;
  clearFilters: () => void;
  applyQuickPreset: (preset: QuickPreset) => void;
}

export function QuestionsToolbar({
  activeFilter,
  setActiveFilter,
  difficultyFilter,
  setDifficultyFilter,
  textStatusFilter,
  setTextStatusFilter,
  minUsage,
  setMinUsage,
  sort,
  setSort,
  order,
  toggleOrder,
  clearFilters,
  applyQuickPreset,
}: QuestionsToolbarProps): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => applyQuickPreset("needs-copy")}>
          Needs Copy
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickPreset("high-impact")}>
          High Impact
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickPreset("inactive")}>
          Inactive
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickPreset("hard")}>
          Hard + High Use
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          aria-label="Filter by active state"
        >
          <option value="all">All status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select
          value={difficultyFilter}
          onChange={(event) => setDifficultyFilter(event.target.value as DifficultyFilter)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          aria-label="Filter by difficulty"
        >
          <option value="all">All difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="unset">Unset</option>
        </select>
        <select
          value={textStatusFilter}
          onChange={(event) => setTextStatusFilter(event.target.value as TextStatusFilter)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          aria-label="Filter by question text status"
        >
          <option value="all">All text</option>
          <option value="missing">Missing text</option>
          <option value="present">Has text</option>
        </select>
        <Input
          value={minUsage}
          onChange={(event) => {
            const next = event.target.value;
            if (isValidMinUsageInput(next)) {
              setMinUsage(next);
            }
          }}
          placeholder="Min uses"
          className="h-9 w-24"
          inputMode="numeric"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as QuestionSort)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          aria-label="Sort questions"
        >
          <option value="usage">Sort: Uses</option>
          <option value="key">Sort: Key</option>
          <option value="difficulty">Sort: Difficulty</option>
          <option value="createdAt">Sort: Created</option>
          <option value="active">Sort: Active</option>
        </select>
        <Button variant="outline" size="sm" onClick={toggleOrder}>
          {order === "desc" ? "Desc" : "Asc"}
        </Button>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
