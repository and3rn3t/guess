// Pure helpers for the Questions admin route. Extracted from QuestionsRoute.tsx
// during the RF.6d refactor. No DOM, no fetch, no state — only data transforms.

import type {
  AdminQuestion,
  DifficultyValue,
  ExpansionRun,
  QuestionExpansionResult,
  QuestionScoreResult,
  QuickPreset,
  RewriteCandidate,
  RunModeFilter,
  RunStatusFilter,
  ActiveFilter,
  DifficultyFilter,
  TextStatusFilter,
  QuestionSort,
  SortOrder,
} from "./questionsTypes";

export const SKELETON_ROW_KEYS = [
  "skeleton-row-1",
  "skeleton-row-2",
  "skeleton-row-3",
  "skeleton-row-4",
  "skeleton-row-5",
  "skeleton-row-6",
  "skeleton-row-7",
  "skeleton-row-8",
];

export const SCORE_BAR_WIDTH_CLASSES: Record<number, string> = {
  0: "w-0",
  1: "w-1/5",
  2: "w-2/5",
  3: "w-3/5",
  4: "w-4/5",
  5: "w-full",
};

/** Clamp a 0–5 score, returning an integer suitable for SCORE_BAR_WIDTH_CLASSES. */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(5, value));
}

/** Tailwind color class for a 0–5 quality score. */
export function scoreBarColor(value: number): string {
  if (value >= 4) return "bg-green-500";
  if (value >= 3) return "bg-yellow-500";
  return "bg-red-500";
}

/** Visibility filter for expansion run history rows. */
export function filterExpansionRuns(
  runs: readonly ExpansionRun[],
  statusFilter: RunStatusFilter,
  modeFilter: RunModeFilter,
): ExpansionRun[] {
  return runs.filter((run) => {
    const statusOk = statusFilter === "all" || run.status === statusFilter;
    const mode = run.dryRun ? "dry-run" : "apply";
    const modeOk = modeFilter === "all" || mode === modeFilter;
    return statusOk && modeOk;
  });
}

export interface FilterState {
  activeFilter: ActiveFilter;
  difficultyFilter: DifficultyFilter;
  textStatusFilter: TextStatusFilter;
  sort: QuestionSort;
  order: SortOrder;
  minUsage: string;
}

/** Default filter state — used by Clear Filters. */
export function defaultFilterState(): FilterState {
  return {
    activeFilter: "all",
    difficultyFilter: "all",
    textStatusFilter: "all",
    sort: "usage",
    order: "desc",
    minUsage: "",
  };
}

/** Map a quick-preset chip to its filter overrides. */
export function quickPresetFilters(preset: QuickPreset): FilterState {
  if (preset === "needs-copy") {
    return {
      activeFilter: "active",
      difficultyFilter: "all",
      textStatusFilter: "missing",
      sort: "usage",
      order: "desc",
      minUsage: "",
    };
  }
  if (preset === "high-impact") {
    return {
      activeFilter: "active",
      difficultyFilter: "all",
      textStatusFilter: "all",
      sort: "usage",
      order: "desc",
      minUsage: "50",
    };
  }
  if (preset === "inactive") {
    return {
      activeFilter: "inactive",
      difficultyFilter: "all",
      textStatusFilter: "all",
      sort: "key",
      order: "asc",
      minUsage: "",
    };
  }
  // "hard"
  return {
    activeFilter: "active",
    difficultyFilter: "hard",
    textStatusFilter: "all",
    sort: "usage",
    order: "desc",
    minUsage: "20",
  };
}

/** Build a RewriteCandidate from a scoring result, or null when there is no
 * meaningful rewrite (empty / unchanged). */
export function buildRewriteCandidate(
  question: AdminQuestion,
  score: QuestionScoreResult,
): RewriteCandidate | null {
  if (!score.rewrite) return null;
  const trimmedOriginal = (question.questionText ?? "").trim();
  const trimmedRewrite = score.rewrite.trim();
  if (!trimmedRewrite || trimmedRewrite === trimmedOriginal) return null;

  return {
    key: question.key,
    originalText: trimmedOriginal,
    rewriteText: trimmedRewrite,
    clarity: score.clarity,
    power: score.power,
    grammar: score.grammar,
    averageScore: (score.clarity + score.power + score.grammar) / 3,
    usageCount: question.usageCount,
  };
}

/** Insert (or replace) a rewrite candidate into the queue and re-sort: lowest
 * average score first, then highest usage, then key tiebreak. */
export function upsertSortedCandidate(
  queue: readonly RewriteCandidate[],
  candidate: RewriteCandidate,
): RewriteCandidate[] {
  const next = queue.filter((item) => item.key !== candidate.key);
  next.push(candidate);
  next.sort((a, b) => {
    if (a.averageScore !== b.averageScore) return a.averageScore - b.averageScore;
    if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
    return a.key.localeCompare(b.key);
  });
  return next;
}

/** Parse the difficulty <select> value back to a DifficultyValue (null = unset). */
export function parseDifficultySelection(value: string): DifficultyValue {
  return value === "unset" ? null : (value as "easy" | "medium" | "hard");
}

/** Format the success banner shown after an expansion run. */
export function formatExpansionMessage(result: QuestionExpansionResult): string {
  if (result.dryRun) {
    return `Preview complete: ${result.candidates} candidate questions across ${result.targetAttributes} attributes.`;
  }
  return `Applied expansion: inserted ${result.inserted} of ${result.candidates} candidates across ${result.targetAttributes} attributes.`;
}

/** Format the toast message for a bulk update (e.g. "Updated 3 questions:
 * activated, difficulty set to easy"). */
export function formatBulkUpdateMessage(
  count: number,
  payload: { isActive?: boolean; difficulty?: "easy" | "medium" | "hard" | null },
): string {
  const updates: string[] = [];
  if (payload.isActive !== undefined) {
    updates.push(payload.isActive ? "activated" : "deactivated");
  }
  if (payload.difficulty !== undefined) {
    updates.push(
      payload.difficulty === null
        ? "difficulty cleared"
        : `difficulty set to ${payload.difficulty}`,
    );
  }
  const plural = count === 1 ? "" : "s";
  return `Updated ${count} question${plural}: ${updates.join(", ")}`;
}

/** Decorative class for the per-row AI score button. */
export function scoreButtonClass(
  scoringKey: string | null,
  scores: Record<string, QuestionScoreResult>,
  key: string,
): string {
  if (scoringKey === key) return "animate-pulse";
  if (scores[key]) return "text-violet-400";
  return "text-muted-foreground";
}

/** Validates a numeric Min-uses input — accepts the empty string or digits only. */
export function isValidMinUsageInput(value: string): boolean {
  return value === "" || /^\d+$/.test(value);
}

/** Build the URLSearchParams used by the list endpoint. */
export function buildQuestionsListParams(input: {
  search: string;
  activeFilter: ActiveFilter;
  difficultyFilter: DifficultyFilter;
  textStatusFilter: TextStatusFilter;
  sort: QuestionSort;
  order: SortOrder;
  minUsage: string;
  page: number;
  pageSize: number;
}): URLSearchParams {
  return new URLSearchParams({
    search: input.search,
    active: input.activeFilter,
    difficulty: input.difficultyFilter,
    textStatus: input.textStatusFilter,
    sort: input.sort,
    order: input.order,
    minUsage: input.minUsage,
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
}
