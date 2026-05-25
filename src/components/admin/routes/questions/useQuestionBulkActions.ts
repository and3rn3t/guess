import { useCallback, useState } from "react";
import { toast } from "sonner";

import { ADMIN_API_ENDPOINTS } from "@/lib/constants";
import { JSON_CONTENT_TYPE } from "@/lib/http";

import type { DifficultyFilter } from "./questionsTypes";
import { formatBulkUpdateMessage } from "./questionsHelpers";

interface Args {
  selectedKeys: Set<string>;
  refetchListing: () => Promise<void>;
}

export interface UseQuestionBulkActionsResult {
  bulkUpdating: boolean;
  bulkDifficulty: DifficultyFilter;
  setBulkDifficulty: React.Dispatch<React.SetStateAction<DifficultyFilter>>;
  runBulkUpdate: (payload: {
    isActive?: boolean;
    difficulty?: "easy" | "medium" | "hard" | null;
  }) => Promise<void>;
  applyBulkDifficulty: () => Promise<void>;
}

export function useQuestionBulkActions({
  selectedKeys,
  refetchListing,
}: Args): UseQuestionBulkActionsResult {
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDifficulty, setBulkDifficulty] = useState<DifficultyFilter>("all");

  const runBulkUpdate = useCallback(
    async (payload: {
      isActive?: boolean;
      difficulty?: "easy" | "medium" | "hard" | null;
    }) => {
      if (selectedKeys.size === 0) return;
      setBulkUpdating(true);
      try {
        const res = await fetch(ADMIN_API_ENDPOINTS.questionsBulk, {
          method: "POST",
          headers: JSON_CONTENT_TYPE,
          body: JSON.stringify({
            keys: Array.from(selectedKeys),
            ...payload,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? res.statusText);
        }

        toast.success(formatBulkUpdateMessage(selectedKeys.size, payload));
        await refetchListing();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Bulk update failed");
      } finally {
        setBulkUpdating(false);
      }
    },
    [selectedKeys, refetchListing],
  );

  const applyBulkDifficulty = useCallback(async () => {
    if (bulkDifficulty === "all") return;
    const difficultyValue =
      bulkDifficulty === "unset" ? null : bulkDifficulty;
    await runBulkUpdate({ difficulty: difficultyValue });
  }, [bulkDifficulty, runBulkUpdate]);

  return {
    bulkUpdating,
    bulkDifficulty,
    setBulkDifficulty,
    runBulkUpdate,
    applyBulkDifficulty,
  };
}
