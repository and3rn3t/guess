import { useCallback, useEffect, useState } from "react";

import { ADMIN_API_ENDPOINTS } from "@/lib/constants";
import { JSON_CONTENT_TYPE } from "@/lib/http";

import type {
  ExpansionRun,
  QuestionExpansionResult,
  RunModeFilter,
  RunStatusFilter,
} from "./questionsTypes";
import { filterExpansionRuns, formatExpansionMessage } from "./questionsHelpers";

interface Args {
  refetchListing: () => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UseQuestionExpansionResult {
  expansionRuns: ExpansionRun[];
  expanding: boolean;
  expansionMessage: string | null;
  runStatusFilter: RunStatusFilter;
  setRunStatusFilter: React.Dispatch<React.SetStateAction<RunStatusFilter>>;
  runModeFilter: RunModeFilter;
  setRunModeFilter: React.Dispatch<React.SetStateAction<RunModeFilter>>;
  visibleExpansionRuns: ExpansionRun[];
  fetchExpansionHistory: () => Promise<void>;
  expandQuestions: (dryRun: boolean) => Promise<void>;
}

export function useQuestionExpansion({
  refetchListing,
  setError,
}: Args): UseQuestionExpansionResult {
  const [expansionRuns, setExpansionRuns] = useState<ExpansionRun[]>([]);
  const [expanding, setExpanding] = useState(false);
  const [expansionMessage, setExpansionMessage] = useState<string | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<RunStatusFilter>("all");
  const [runModeFilter, setRunModeFilter] = useState<RunModeFilter>("all");

  const fetchExpansionHistory = useCallback(async () => {
    try {
      const res = await fetch(ADMIN_API_ENDPOINTS.questionsExpand);
      if (!res.ok) return;
      const body = (await res.json()) as { runs?: ExpansionRun[] };
      setExpansionRuns(body.runs ?? []);
    } catch {
      // Non-fatal for route UX.
    }
  }, []);

  const expandQuestions = useCallback(
    async (dryRun: boolean) => {
      setExpanding(true);
      setError(null);
      setExpansionMessage(null);
      try {
        const res = await fetch(ADMIN_API_ENDPOINTS.questionsExpand, {
          method: "POST",
          headers: JSON_CONTENT_TYPE,
          body: JSON.stringify({
            dryRun,
            limit: 40,
            minCharacterCount: 25,
            maxPerAttribute: 2,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? res.statusText);
        }

        const result = (await res.json()) as QuestionExpansionResult;
        setExpansionMessage(formatExpansionMessage(result));
        if (!dryRun) {
          await refetchListing();
        }
        await fetchExpansionHistory();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Question expansion failed");
      } finally {
        setExpanding(false);
      }
    },
    [refetchListing, fetchExpansionHistory, setError],
  );

  useEffect(() => {
    void fetchExpansionHistory();
  }, [fetchExpansionHistory]);

  const visibleExpansionRuns = filterExpansionRuns(
    expansionRuns,
    runStatusFilter,
    runModeFilter,
  );

  return {
    expansionRuns,
    expanding,
    expansionMessage,
    runStatusFilter,
    setRunStatusFilter,
    runModeFilter,
    setRunModeFilter,
    visibleExpansionRuns,
    fetchExpansionHistory,
    expandQuestions,
  };
}
