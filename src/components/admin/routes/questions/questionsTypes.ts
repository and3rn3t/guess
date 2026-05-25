// Pure types for the Questions admin route. Extracted from QuestionsRoute.tsx
// during the RF.6d refactor — no behavior change.

export interface QuestionScoreResult {
  clarity: number;
  power: number;
  grammar: number;
  rewrite?: string;
}

export interface RewriteCandidate {
  key: string;
  originalText: string;
  rewriteText: string;
  clarity: number;
  power: number;
  grammar: number;
  averageScore: number;
  usageCount: number;
}

export interface QuestionExpansionResult {
  ok: boolean;
  dryRun: boolean;
  targetAttributes: number;
  candidates: number;
  inserted: number;
}

export interface ExpansionRun {
  requestId: string;
  dryRun: boolean;
  targetAttributes: number;
  candidates: number;
  inserted: number;
  createdAt: string;
  status: "success" | "error";
  error?: string;
}

export interface AdminQuestion {
  key: string;
  displayText: string;
  questionText: string | null;
  isActive: boolean;
  usageCount: number;
  difficulty: string | null;
  createdAt?: number;
}

export interface PageData {
  questions: AdminQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

export type ActiveFilter = "all" | "active" | "inactive";
export type DifficultyFilter = "all" | "easy" | "medium" | "hard" | "unset";
export type TextStatusFilter = "all" | "missing" | "present";
export type QuestionSort = "usage" | "key" | "difficulty" | "createdAt" | "active";
export type SortOrder = "asc" | "desc";
export type DifficultyValue = "easy" | "medium" | "hard" | null;
export type RunStatusFilter = "all" | "success" | "error";
export type RunModeFilter = "all" | "dry-run" | "apply";
export type QuickPreset = "needs-copy" | "high-impact" | "inactive" | "hard";
