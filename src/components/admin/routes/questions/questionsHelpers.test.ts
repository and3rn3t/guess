import { describe, it, expect } from "vitest";
import {
  SKELETON_ROW_KEYS,
  SCORE_BAR_WIDTH_CLASSES,
  clampScore,
  scoreBarColor,
  filterExpansionRuns,
  defaultFilterState,
  quickPresetFilters,
  buildRewriteCandidate,
  upsertSortedCandidate,
  parseDifficultySelection,
  formatExpansionMessage,
  formatBulkUpdateMessage,
  scoreButtonClass,
  isValidMinUsageInput,
  buildQuestionsListParams,
} from "./questionsHelpers";
import type {
  AdminQuestion,
  ExpansionRun,
  QuestionScoreResult,
  RewriteCandidate,
} from "./questionsTypes";

const Q = (overrides: Partial<AdminQuestion> = {}): AdminQuestion => ({
  key: "isHuman",
  displayText: "Is human?",
  questionText: "Is the character human?",
  isActive: true,
  usageCount: 10,
  difficulty: "easy",
  ...overrides,
});

const RUN = (overrides: Partial<ExpansionRun> = {}): ExpansionRun => ({
  requestId: "r1",
  dryRun: true,
  targetAttributes: 1,
  candidates: 1,
  inserted: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "success",
  ...overrides,
});

describe("questionsHelpers", () => {
  describe("SKELETON_ROW_KEYS / SCORE_BAR_WIDTH_CLASSES", () => {
    it("has eight skeleton row keys", () => {
      expect(SKELETON_ROW_KEYS).toHaveLength(8);
      expect(new Set(SKELETON_ROW_KEYS).size).toBe(8);
    });

    it("maps each integer 0–5 to a Tailwind width class", () => {
      for (let i = 0; i <= 5; i++) {
        expect(SCORE_BAR_WIDTH_CLASSES[i]).toBeDefined();
      }
    });
  });

  describe("clampScore", () => {
    it("clamps below zero to 0", () => {
      expect(clampScore(-3)).toBe(0);
    });
    it("clamps above five to 5", () => {
      expect(clampScore(99)).toBe(5);
    });
    it("passes valid values through unchanged", () => {
      expect(clampScore(3)).toBe(3);
    });
  });

  describe("scoreBarColor", () => {
    it("returns green for >= 4", () => {
      expect(scoreBarColor(4)).toBe("bg-green-500");
      expect(scoreBarColor(5)).toBe("bg-green-500");
    });
    it("returns yellow for 3 <= v < 4", () => {
      expect(scoreBarColor(3)).toBe("bg-yellow-500");
      expect(scoreBarColor(3.5)).toBe("bg-yellow-500");
    });
    it("returns red below 3", () => {
      expect(scoreBarColor(0)).toBe("bg-red-500");
      expect(scoreBarColor(2.9)).toBe("bg-red-500");
    });
  });

  describe("filterExpansionRuns", () => {
    const runs: ExpansionRun[] = [
      RUN({ requestId: "a", status: "success", dryRun: true }),
      RUN({ requestId: "b", status: "error", dryRun: false }),
      RUN({ requestId: "c", status: "success", dryRun: false }),
    ];

    it("returns all runs when both filters are 'all'", () => {
      expect(filterExpansionRuns(runs, "all", "all")).toHaveLength(3);
    });
    it("filters by status", () => {
      const out = filterExpansionRuns(runs, "error", "all");
      expect(out).toEqual([runs[1]]);
    });
    it("filters by mode", () => {
      const out = filterExpansionRuns(runs, "all", "apply");
      expect(out.map((r) => r.requestId)).toEqual(["b", "c"]);
    });
    it("combines status and mode filters", () => {
      const out = filterExpansionRuns(runs, "success", "dry-run");
      expect(out.map((r) => r.requestId)).toEqual(["a"]);
    });
  });

  describe("defaultFilterState / quickPresetFilters", () => {
    it("default filter state has 'all' across the board", () => {
      const s = defaultFilterState();
      expect(s.activeFilter).toBe("all");
      expect(s.sort).toBe("usage");
      expect(s.order).toBe("desc");
      expect(s.minUsage).toBe("");
    });

    it("'needs-copy' targets active rows missing question text", () => {
      const s = quickPresetFilters("needs-copy");
      expect(s.activeFilter).toBe("active");
      expect(s.textStatusFilter).toBe("missing");
    });

    it("'high-impact' sets minUsage to 50", () => {
      expect(quickPresetFilters("high-impact").minUsage).toBe("50");
    });

    it("'inactive' sorts by key ascending", () => {
      const s = quickPresetFilters("inactive");
      expect(s.activeFilter).toBe("inactive");
      expect(s.sort).toBe("key");
      expect(s.order).toBe("asc");
    });

    it("'hard' targets active hard rows with minUsage 20", () => {
      const s = quickPresetFilters("hard");
      expect(s.difficultyFilter).toBe("hard");
      expect(s.minUsage).toBe("20");
    });
  });

  describe("buildRewriteCandidate", () => {
    const score: QuestionScoreResult = {
      clarity: 3,
      power: 4,
      grammar: 5,
      rewrite: "A clearer question?",
    };

    it("returns null when no rewrite is present", () => {
      expect(buildRewriteCandidate(Q(), { ...score, rewrite: undefined })).toBeNull();
    });

    it("returns null when the rewrite is whitespace-only", () => {
      expect(buildRewriteCandidate(Q(), { ...score, rewrite: "   " })).toBeNull();
    });

    it("returns null when the rewrite matches the trimmed original", () => {
      const q = Q({ questionText: "  A clearer question?  " });
      expect(buildRewriteCandidate(q, score)).toBeNull();
    });

    it("populates the candidate and averages the scores", () => {
      const c = buildRewriteCandidate(Q(), score);
      expect(c).not.toBeNull();
      expect(c!.averageScore).toBeCloseTo(4);
      expect(c!.originalText).toBe("Is the character human?");
      expect(c!.rewriteText).toBe("A clearer question?");
    });
  });

  describe("upsertSortedCandidate", () => {
    const C = (overrides: Partial<RewriteCandidate>): RewriteCandidate => ({
      key: "k",
      originalText: "o",
      rewriteText: "r",
      clarity: 0,
      power: 0,
      grammar: 0,
      averageScore: 3,
      usageCount: 10,
      ...overrides,
    });

    it("sorts lowest average score first", () => {
      const out = upsertSortedCandidate(
        [C({ key: "a", averageScore: 4 })],
        C({ key: "b", averageScore: 2 }),
      );
      expect(out.map((x) => x.key)).toEqual(["b", "a"]);
    });

    it("breaks ties by higher usage first", () => {
      const out = upsertSortedCandidate(
        [C({ key: "low", averageScore: 3, usageCount: 5 })],
        C({ key: "high", averageScore: 3, usageCount: 50 }),
      );
      expect(out.map((x) => x.key)).toEqual(["high", "low"]);
    });

    it("replaces an existing entry with the same key", () => {
      const out = upsertSortedCandidate(
        [C({ key: "k", averageScore: 5 })],
        C({ key: "k", averageScore: 1 }),
      );
      expect(out).toHaveLength(1);
      expect(out[0].averageScore).toBe(1);
    });
  });

  describe("parseDifficultySelection", () => {
    it("maps 'unset' to null", () => {
      expect(parseDifficultySelection("unset")).toBeNull();
    });
    it("passes other values through as-is", () => {
      expect(parseDifficultySelection("easy")).toBe("easy");
      expect(parseDifficultySelection("hard")).toBe("hard");
    });
  });

  describe("formatExpansionMessage", () => {
    it("formats a dry-run preview", () => {
      const msg = formatExpansionMessage({
        ok: true,
        dryRun: true,
        targetAttributes: 4,
        candidates: 7,
        inserted: 0,
      });
      expect(msg).toMatch(/Preview complete: 7 candidate questions across 4 attributes/);
    });
    it("formats an applied run", () => {
      const msg = formatExpansionMessage({
        ok: true,
        dryRun: false,
        targetAttributes: 4,
        candidates: 7,
        inserted: 5,
      });
      expect(msg).toMatch(/Applied expansion: inserted 5 of 7 candidates/);
    });
  });

  describe("formatBulkUpdateMessage", () => {
    it("describes activation", () => {
      expect(formatBulkUpdateMessage(3, { isActive: true })).toBe(
        "Updated 3 questions: activated",
      );
    });
    it("describes deactivation", () => {
      expect(formatBulkUpdateMessage(1, { isActive: false })).toBe(
        "Updated 1 question: deactivated",
      );
    });
    it("describes difficulty set", () => {
      expect(formatBulkUpdateMessage(2, { difficulty: "easy" })).toBe(
        "Updated 2 questions: difficulty set to easy",
      );
    });
    it("describes difficulty cleared", () => {
      expect(formatBulkUpdateMessage(2, { difficulty: null })).toBe(
        "Updated 2 questions: difficulty cleared",
      );
    });
    it("joins multiple updates with a comma", () => {
      expect(
        formatBulkUpdateMessage(4, { isActive: true, difficulty: "hard" }),
      ).toBe("Updated 4 questions: activated, difficulty set to hard");
    });
  });

  describe("scoreButtonClass", () => {
    it("animates while scoring", () => {
      expect(scoreButtonClass("k", {}, "k")).toBe("animate-pulse");
    });
    it("colors violet once scored", () => {
      const scores = { k: { clarity: 4, power: 4, grammar: 4 } };
      expect(scoreButtonClass(null, scores, "k")).toBe("text-violet-400");
    });
    it("falls back to muted otherwise", () => {
      expect(scoreButtonClass(null, {}, "k")).toBe("text-muted-foreground");
    });
  });

  describe("isValidMinUsageInput", () => {
    it("accepts the empty string", () => {
      expect(isValidMinUsageInput("")).toBe(true);
    });
    it("accepts digit-only values", () => {
      expect(isValidMinUsageInput("123")).toBe(true);
    });
    it("rejects mixed input", () => {
      expect(isValidMinUsageInput("12a")).toBe(false);
      expect(isValidMinUsageInput("-1")).toBe(false);
    });
  });

  describe("buildQuestionsListParams", () => {
    it("includes every filter and pagination field", () => {
      const params = buildQuestionsListParams({
        search: "human",
        activeFilter: "active",
        difficultyFilter: "hard",
        textStatusFilter: "missing",
        sort: "key",
        order: "asc",
        minUsage: "10",
        page: 2,
        pageSize: 25,
      });
      expect(params.get("search")).toBe("human");
      expect(params.get("active")).toBe("active");
      expect(params.get("difficulty")).toBe("hard");
      expect(params.get("textStatus")).toBe("missing");
      expect(params.get("sort")).toBe("key");
      expect(params.get("order")).toBe("asc");
      expect(params.get("minUsage")).toBe("10");
      expect(params.get("page")).toBe("2");
      expect(params.get("pageSize")).toBe("25");
    });
  });
});
