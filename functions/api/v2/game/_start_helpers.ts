import { d1Query } from "../../_helpers";
import type { QuestionsRow } from "../../_db-types";

export type QuestionRow = Pick<QuestionsRow, "id" | "text" | "attribute_key">;

export const DIFFICULTY_TO_PERSONA: Record<string, string> = {
  easy: "poirot",
  medium: "watson",
  hard: "sherlock",
};

function isMissingRetiredAtColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("no such column: retired_at");
}

export async function loadQuestionsWithRetirementFallback(
  db: D1Database,
): Promise<QuestionRow[]> {
  try {
    return await d1Query<QuestionRow>(
      db,
      "SELECT id, text, attribute_key FROM questions WHERE retired_at IS NULL ORDER BY priority DESC",
    );
  } catch (error) {
    if (!isMissingRetiredAtColumnError(error)) throw error;
    return d1Query<QuestionRow>(
      db,
      "SELECT id, text, attribute_key FROM questions ORDER BY priority DESC",
    );
  }
}

export function parseTrivia(
  raw: string | null | undefined,
): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const cleaned = parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 3);
    return cleaned.length > 0 ? cleaned : undefined;
  } catch {
    return undefined;
  }
}
