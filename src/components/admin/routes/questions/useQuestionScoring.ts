import { useCallback, useState } from "react";
import { toast } from "sonner";

import { adminQuestionPath, adminQuestionScorePath } from "@/lib/constants";
import { JSON_CONTENT_TYPE } from "@/lib/http";

import type {
  AdminQuestion,
  PageData,
  QuestionScoreResult,
  RewriteCandidate,
} from "./questionsTypes";
import { buildRewriteCandidate, upsertSortedCandidate } from "./questionsHelpers";

interface Args {
  data: PageData | null;
  setData: React.Dispatch<React.SetStateAction<PageData | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  selectedKeys: Set<string>;
}

export interface UseQuestionScoringResult {
  scores: Record<string, QuestionScoreResult>;
  scoringKey: string | null;
  rewriteQueue: RewriteCandidate[];
  bulkScoring: boolean;
  bulkScoreProgress: { done: number; total: number };
  scoreQuestion: (q: AdminQuestion) => Promise<void>;
  scoreSelectedQuestions: () => Promise<void>;
  applyRewriteCandidate: (candidate: RewriteCandidate) => Promise<boolean>;
  applyAllRewrites: () => Promise<void>;
}

async function requestQuestionScore(
  question: AdminQuestion,
): Promise<QuestionScoreResult> {
  const res = await fetch(adminQuestionScorePath(question.key), {
    method: "POST",
    headers: JSON_CONTENT_TYPE,
    body: JSON.stringify({
      displayText: question.displayText,
      questionText: question.questionText,
    }),
  });
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()) as QuestionScoreResult;
}

export function useQuestionScoring({
  data,
  setData,
  setError,
  selectedKeys,
}: Args): UseQuestionScoringResult {
  const [scores, setScores] = useState<Record<string, QuestionScoreResult>>({});
  const [scoringKey, setScoringKey] = useState<string | null>(null);
  const [rewriteQueue, setRewriteQueue] = useState<RewriteCandidate[]>([]);
  const [bulkScoring, setBulkScoring] = useState(false);
  const [bulkScoreProgress, setBulkScoreProgress] = useState<{
    done: number;
    total: number;
  }>({ done: 0, total: 0 });

  const upsertRewriteCandidate = useCallback(
    (question: AdminQuestion, score: QuestionScoreResult) => {
      const candidate = buildRewriteCandidate(question, score);
      if (!candidate) return;
      setRewriteQueue((prev) => upsertSortedCandidate(prev, candidate));
    },
    [],
  );

  const scoreQuestion = useCallback(
    async (q: AdminQuestion) => {
      setScoringKey(q.key);
      try {
        const result = await requestQuestionScore(q);
        setScores((prev) => ({ ...prev, [q.key]: result }));
        upsertRewriteCandidate(q, result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scoring failed");
      } finally {
        setScoringKey(null);
      }
    },
    [setError, upsertRewriteCandidate],
  );

  const scoreSelectedQuestions = useCallback(async () => {
    if (selectedKeys.size === 0 || !data) return;
    const selectedQuestions = data.questions.filter((q) =>
      selectedKeys.has(q.key),
    );
    if (selectedQuestions.length === 0) return;

    setBulkScoring(true);
    setBulkScoreProgress({ done: 0, total: selectedQuestions.length });

    let failed = 0;
    for (const [index, question] of selectedQuestions.entries()) {
      try {
        const result = await requestQuestionScore(question);
        setScores((prev) => ({ ...prev, [question.key]: result }));
        upsertRewriteCandidate(question, result);
      } catch {
        failed += 1;
      } finally {
        setBulkScoreProgress({
          done: index + 1,
          total: selectedQuestions.length,
        });
      }
    }

    if (failed > 0) {
      toast.error(
        `Bulk AI scoring completed with ${failed} failure${failed === 1 ? "" : "s"}`,
      );
    } else {
      toast.success(
        `Scored ${selectedQuestions.length} question${selectedQuestions.length === 1 ? "" : "s"}`,
      );
    }

    setBulkScoring(false);
  }, [selectedKeys, data, upsertRewriteCandidate]);

  const applyRewriteCandidate = useCallback(
    async (candidate: RewriteCandidate): Promise<boolean> => {
      try {
        const res = await fetch(adminQuestionPath(candidate.key), {
          method: "PATCH",
          headers: JSON_CONTENT_TYPE,
          body: JSON.stringify({ questionText: candidate.rewriteText }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? res.statusText);
        }

        setData((prev) =>
          prev
            ? {
                ...prev,
                questions: prev.questions.map((question) =>
                  question.key === candidate.key
                    ? { ...question, questionText: candidate.rewriteText }
                    : question,
                ),
              }
            : prev,
        );
        setRewriteQueue((prev) =>
          prev.filter((item) => item.key !== candidate.key),
        );
        return true;
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Failed to apply rewrite for ${candidate.key}: ${e.message}`
            : `Failed to apply rewrite for ${candidate.key}`,
        );
        return false;
      }
    },
    [setData],
  );

  const applyAllRewrites = useCallback(async () => {
    if (rewriteQueue.length === 0) return;
    const queueSnapshot = [...rewriteQueue];
    let applied = 0;
    for (const candidate of queueSnapshot) {
      if (await applyRewriteCandidate(candidate)) {
        applied += 1;
      }
    }
    toast.success(`Applied ${applied} rewrite${applied === 1 ? "" : "s"}`);
  }, [rewriteQueue, applyRewriteCandidate]);

  return {
    scores,
    scoringKey,
    rewriteQueue,
    bulkScoring,
    bulkScoreProgress,
    scoreQuestion,
    scoreSelectedQuestions,
    applyRewriteCandidate,
    applyAllRewrites,
  };
}
