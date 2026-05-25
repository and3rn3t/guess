import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { adminQuestionPath } from "@/lib/constants";
import { JSON_CONTENT_TYPE } from "@/lib/http";

import type {
  AdminQuestion,
  DifficultyValue,
  PageData,
} from "./questionsTypes";

interface Args {
  setData: React.Dispatch<React.SetStateAction<PageData | null>>;
}

export interface UseQuestionInlineEditsResult {
  editingKey: string | null;
  editValue: string;
  setEditValue: React.Dispatch<React.SetStateAction<string>>;
  editRef: React.RefObject<HTMLInputElement | null>;
  saving: boolean;
  difficultySavingKeys: Set<string>;
  startEdit: (q: AdminQuestion) => void;
  cancelEdit: () => void;
  saveEdit: (key: string) => Promise<void>;
  toggleActive: (q: AdminQuestion) => Promise<void>;
  updateDifficultyInline: (
    q: AdminQuestion,
    nextDifficulty: DifficultyValue,
  ) => Promise<void>;
}

export function useQuestionInlineEdits({
  setData,
}: Args): UseQuestionInlineEditsResult {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [difficultySavingKeys, setDifficultySavingKeys] = useState<Set<string>>(
    new Set(),
  );
  const editRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((q: AdminQuestion) => {
    setEditingKey(q.key);
    setEditValue(q.questionText ?? "");
    setTimeout(() => editRef.current?.focus(), 50);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditValue("");
  }, []);

  const saveEdit = useCallback(
    async (key: string) => {
      setSaving(true);
      try {
        const res = await fetch(adminQuestionPath(key), {
          method: "PATCH",
          headers: JSON_CONTENT_TYPE,
          body: JSON.stringify({ questionText: editValue }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? res.statusText);
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                questions: prev.questions.map((q) =>
                  q.key === key ? { ...q, questionText: editValue } : q,
                ),
              }
            : prev,
        );
        toast.success("Question saved");
        cancelEdit();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [editValue, setData, cancelEdit],
  );

  const toggleActive = useCallback(
    async (q: AdminQuestion) => {
      const next = !q.isActive;
      setData((prev) =>
        prev
          ? {
              ...prev,
              questions: prev.questions.map((item) =>
                item.key === q.key ? { ...item, isActive: next } : item,
              ),
            }
          : prev,
      );
      try {
        const res = await fetch(adminQuestionPath(q.key), {
          method: "PATCH",
          headers: JSON_CONTENT_TYPE,
          body: JSON.stringify({ isActive: next }),
        });
        if (!res.ok) throw new Error(res.statusText);
      } catch {
        setData((prev) =>
          prev
            ? {
                ...prev,
                questions: prev.questions.map((item) =>
                  item.key === q.key ? { ...item, isActive: q.isActive } : item,
                ),
              }
            : prev,
        );
      }
    },
    [setData],
  );

  const updateDifficultyInline = useCallback(
    async (q: AdminQuestion, nextDifficulty: DifficultyValue) => {
      const previousDifficulty = q.difficulty;
      if (previousDifficulty === nextDifficulty) return;

      setDifficultySavingKeys((prev) => new Set(prev).add(q.key));
      setData((prev) =>
        prev
          ? {
              ...prev,
              questions: prev.questions.map((item) =>
                item.key === q.key
                  ? { ...item, difficulty: nextDifficulty }
                  : item,
              ),
            }
          : prev,
      );

      try {
        const res = await fetch(adminQuestionPath(q.key), {
          method: "PATCH",
          headers: JSON_CONTENT_TYPE,
          body: JSON.stringify({ difficulty: nextDifficulty }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? res.statusText);
        }
      } catch (e) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                questions: prev.questions.map((item) =>
                  item.key === q.key
                    ? { ...item, difficulty: previousDifficulty }
                    : item,
                ),
              }
            : prev,
        );
        toast.error(
          e instanceof Error
            ? `Failed to update difficulty for ${q.key}: ${e.message}`
            : `Failed to update difficulty for ${q.key}`,
        );
      } finally {
        setDifficultySavingKeys((prev) => {
          const next = new Set(prev);
          next.delete(q.key);
          return next;
        });
      }
    },
    [setData],
  );

  return {
    editingKey,
    editValue,
    setEditValue,
    editRef,
    saving,
    difficultySavingKeys,
    startEdit,
    cancelEdit,
    saveEdit,
    toggleActive,
    updateDifficultyInline,
  };
}
